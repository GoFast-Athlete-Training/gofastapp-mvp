/**
 * First OpenAI prompt for athlete Create my own — infers long-run pools + weekly range from goal.
 */

import type { AthletePresetFitnessPhase, ProgressionAggressiveness } from "@prisma/client";
import {
  computeCoreVolumeCalendarPreview,
  normalizeLongRunPools,
} from "@/lib/training/core-volume-compute";
import {
  clampPeakLongRunPoolMiles,
  clampPeakLongRunPoolToBand,
} from "@/lib/training/long-run-pool-fields";
import {
  clampWeeklyRangeToKey,
  resolveWeeklyVolumeKey,
  weeklyVolumeKeyPromptTable,
  type WeeklyVolumeBand,
} from "@/lib/training/weekly-volume-key";

export type AthletePresetCoreInferInput = {
  fitnessPhase: AthletePresetFitnessPhase;
  trainingHistory: string;
  ageYears: number | null;
  gender: string | null;
  /** Current fitness signal only — never the weekly target. */
  currentWeeklyMileage: number | null;
  fiveKPace: string | null;
  longRunCapabilityMiles: number | null;
  raceName: string;
  raceDate: string;
  planStartDate: string;
  goalTime: string | null;
  raceDistanceLabel: string | null;
  /** Athlete chose finish-for-fun — sizes weekly band to FINISH without a target time. */
  racingForFun?: boolean;
};

export type AthletePresetCoreInferResult = {
  weSeeYou: string;
  barriers: string[];
  progressionAggressiveness: ProgressionAggressiveness;
  weeklyVolumeBand: WeeklyVolumeBand;
  peakLongRunPoolMiles: number;
  baseLongRunPoolMiles: number;
  taperLongRunPoolMiles: number;
  longestSaturdayMiles: number;
  minWeeklyMiles: number;
  maxWeeklyMiles: number;
  cups: { baseLongRunPoolMiles: number; peakLongRunPoolMiles: number; taperLongRunPoolMiles: number };
  calendar: ReturnType<typeof computeCoreVolumeCalendarPreview>;
};

const AGGRESSIVENESS_VALUES = new Set<ProgressionAggressiveness>([
  "CONSERVATIVE",
  "MODERATE",
  "AMBITIOUS",
]);

function parseAggressiveness(raw: unknown): ProgressionAggressiveness {
  if (typeof raw === "string") {
    const u = raw.trim().toUpperCase() as ProgressionAggressiveness;
    if (AGGRESSIVENESS_VALUES.has(u)) return u;
  }
  return "MODERATE";
}

function clampFloat(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v * 10) / 10));
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1]!.trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("OpenAI response did not contain JSON");
  return JSON.parse(body.slice(start, end + 1));
}

function inferElitePeakPool(input: AthletePresetCoreInferInput, band: WeeklyVolumeBand): boolean {
  if (band === "ELITE") return true;
  const lr = input.longRunCapabilityMiles ?? 0;
  if (lr >= 18) return true;
  const blob = `${input.trainingHistory} ${input.goalTime ?? ""}`.toLowerCase();
  return /\b(sub-?\s*3|sub3|boston|bq\b|qualif|crush|elite)\b/.test(blob);
}

function resolveVolume(input: AthletePresetCoreInferInput, parsed?: Record<string, unknown>) {
  const aggressiveness = parseAggressiveness(parsed?.progressionAggressiveness);
  const row = resolveWeeklyVolumeKey({
    raceDistanceLabel: input.raceDistanceLabel,
    weeklyVolumeBand: input.racingForFun ? "FINISH" : parsed?.weeklyVolumeBand,
    progressionAggressiveness: aggressiveness,
    trainingHistory: input.trainingHistory,
    goalTime: input.goalTime,
    racingForFun: input.racingForFun,
  });
  const weekly = clampWeeklyRangeToKey(row, parsed?.minWeeklyMiles, parsed?.maxWeeklyMiles);
  return { aggressiveness, row, weekly };
}

function resolvePeakLongRunPoolMiles(
  band: WeeklyVolumeBand,
  elite: boolean,
  parsedPeak?: unknown
): number {
  if (band === "FINISH") {
    const raw = Number(parsedPeak);
    const fallback = 30;
    const p = Number.isFinite(raw) && raw > 0 ? raw : fallback;
    return clampPeakLongRunPoolMiles(Math.max(24, Math.min(40, p)));
  }
  let peakRaw = Number(parsedPeak);
  if (!Number.isFinite(peakRaw) || peakRaw <= 0) {
    peakRaw = elite ? 65 : 55;
  }
  return clampPeakLongRunPoolToBand(peakRaw, elite);
}

function fallbackCoreInfer(input: AthletePresetCoreInferInput): AthletePresetCoreInferResult {
  const { aggressiveness, row, weekly } = resolveVolume(input);
  const elite = inferElitePeakPool(input, row.band);
  const peak = resolvePeakLongRunPoolMiles(row.band, elite);
  const cups = normalizeLongRunPools({ peakLongRunPoolMiles: peak });
  const calendar = computeCoreVolumeCalendarPreview({
    planStartDate: new Date(input.planStartDate),
    raceDate: new Date(input.raceDate),
    peakLongRunPoolMiles: cups.peakLongRunPoolMiles,
    fitnessPhase: input.fitnessPhase,
  });
  const lrCap = input.longRunCapabilityMiles;
  const longestSaturdayMiles =
    lrCap != null && lrCap > 0
      ? lrCap
      : Math.round(cups.peakLongRunPoolMiles * 0.28 * 10) / 10;
  const peakSat =
    calendar.peakPoolKey.length > 0
      ? Math.max(...calendar.peakPoolKey.map((s) => s.miles))
      : longestSaturdayMiles;

  return {
    weSeeYou: `For ${input.raceName}, this is a ${row.athleteLabel.toLowerCase()} build — peak long-run pool ${cups.peakLongRunPoolMiles} mi (four Saturdays), biggest Saturday around ${peakSat} mi.`,
    barriers: [],
    progressionAggressiveness: aggressiveness,
    weeklyVolumeBand: row.band,
    peakLongRunPoolMiles: cups.peakLongRunPoolMiles,
    baseLongRunPoolMiles: cups.baseLongRunPoolMiles,
    taperLongRunPoolMiles: cups.taperLongRunPoolMiles,
    longestSaturdayMiles,
    minWeeklyMiles: weekly.minWeeklyMiles,
    maxWeeklyMiles: weekly.maxWeeklyMiles,
    cups,
    calendar,
  };
}

export async function inferAthletePresetCore(
  input: AthletePresetCoreInferInput
): Promise<AthletePresetCoreInferResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return fallbackCoreInfer(input);
  }

  const systemPrompt = `You are inferring a peak long-run POOL and a weekly range for one athlete.

CRITICAL: peakLongRunPoolMiles is the SUM of four Saturday long runs in the peak 4-week block — NOT weekly mileage.
Example marathon peak pool ~70 mi might be four Saturdays: 19.6 + 19.6 + 21 + 9.8.

Peak pool bands (peakLongRunPoolMiles only):
- NORMAL: 50–60 total pool miles
- ELITE (sub-3 / crush / BQ / 18+ Saturday): 60–70 total pool miles

baseLongRunPoolMiles and taperLongRunPoolMiles are smaller 4-Saturday pool totals.

WEEKLY min/max comes ONLY from this key (goal + aggressiveness). Do NOT use current weekly mileage, Peak/Base phase, or the long-run pool to invent weekly.

${weeklyVolumeKeyPromptTable(input.raceDistanceLabel)}

Pick weeklyVolumeBand from race goal + history, then use that row's min–max.
Examples: "just finish a marathon" → FINISH 34–40. "sub-3 / really crush this" → ELITE 50–60.
Never set maxWeeklyMiles equal to peakLongRunPoolMiles.

longestSaturdayMiles = biggest single Saturday in the peak block (not the pool sum).

Infer progressionAggressiveness from free text. Athlete never picks it.
Respect barriers: longest Saturday vs weeks left, speed vs endurance.

Rules:
- Do NOT pick cycle length or block count.
- Do NOT invent catalogue workouts.
- Do NOT output calendar dates.
- Return JSON only:
{
  "weSeeYou": "one breath: goal band + limiter + Saturday peak",
  "barriers": ["string"],
  "progressionAggressiveness": "CONSERVATIVE" | "MODERATE" | "AMBITIOUS",
  "weeklyVolumeBand": "FINISH" | "RACE" | "ELITE",
  "peakLongRunPoolMiles": number,
  "baseLongRunPoolMiles": number,
  "taperLongRunPoolMiles": number,
  "longestSaturdayMiles": number,
  "minWeeklyMiles": number,
  "maxWeeklyMiles": number
}`;

  const userPayload = {
    fitnessPhase: input.fitnessPhase,
    trainingHistory: input.trainingHistory,
    ageYears: input.ageYears,
    gender: input.gender,
    currentWeeklyMileage: input.currentWeeklyMileage,
    fiveKPace: input.fiveKPace,
    longRunCapabilityMiles: input.longRunCapabilityMiles,
    raceName: input.raceName,
    raceDate: input.raceDate,
    planStartDate: input.planStartDate,
    goalTime: input.goalTime,
    raceDistanceLabel: input.raceDistanceLabel,
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPayload, null, 2) },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error("inferAthletePresetCore OpenAI HTTP", res.status, await res.text());
      return fallbackCoreInfer(input);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = extractJsonObject(content) as Record<string, unknown>;
    const { aggressiveness, row, weekly } = resolveVolume(input, parsed);
    const elite = inferElitePeakPool(input, row.band);

    const peakRaw = resolvePeakLongRunPoolMiles(
      row.band,
      elite,
      parsed.peakLongRunPoolMiles
    );

    const cups = normalizeLongRunPools({ peakLongRunPoolMiles: peakRaw });

    const calendar = computeCoreVolumeCalendarPreview({
      planStartDate: new Date(input.planStartDate),
      raceDate: new Date(input.raceDate),
      peakLongRunPoolMiles: cups.peakLongRunPoolMiles,
      fitnessPhase: input.fitnessPhase,
    });

    const peakSatFromKey =
      calendar.peakPoolKey.length > 0
        ? Math.max(...calendar.peakPoolKey.map((s) => s.miles))
        : cups.peakLongRunPoolMiles * 0.28;

    return {
      weSeeYou:
        typeof parsed.weSeeYou === "string" && parsed.weSeeYou.trim()
          ? parsed.weSeeYou.trim()
          : fallbackCoreInfer(input).weSeeYou,
      barriers: Array.isArray(parsed.barriers)
        ? parsed.barriers.filter((b): b is string => typeof b === "string").slice(0, 6)
        : [],
      progressionAggressiveness: aggressiveness,
      weeklyVolumeBand: row.band,
      peakLongRunPoolMiles: cups.peakLongRunPoolMiles,
      baseLongRunPoolMiles: cups.baseLongRunPoolMiles,
      taperLongRunPoolMiles: cups.taperLongRunPoolMiles,
      longestSaturdayMiles: clampFloat(
        parsed.longestSaturdayMiles,
        6,
        30,
        input.longRunCapabilityMiles ?? peakSatFromKey
      ),
      minWeeklyMiles: weekly.minWeeklyMiles,
      maxWeeklyMiles: weekly.maxWeeklyMiles,
      cups,
      calendar,
    };
  } catch (e) {
    console.error("inferAthletePresetCore:", e);
    return fallbackCoreInfer(input);
  }
}

/** @deprecated use normalizeLongRunPools */
export { normalizeLongRunPools as normalizeCoreVolumeCups };
