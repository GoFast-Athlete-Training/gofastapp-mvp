/**
 * First OpenAI prompt for athlete Create my own — infers long-run pools + weekly range from free text.
 */

import type { AthletePresetFitnessPhase, ProgressionAggressiveness } from "@prisma/client";
import {
  computeCoreVolumeCalendarPreview,
  normalizeLongRunPools,
} from "@/lib/training/core-volume-compute";
import { clampPeakLongRunPoolToBand } from "@/lib/training/long-run-pool-fields";

export type AthletePresetCoreInferInput = {
  fitnessPhase: AthletePresetFitnessPhase;
  trainingHistory: string;
  ageYears: number | null;
  gender: string | null;
  weeklyMileage: number;
  fiveKPace: string | null;
  longRunCapabilityMiles: number | null;
  raceName: string;
  raceDate: string;
  planStartDate: string;
  goalTime: string | null;
  raceDistanceLabel: string | null;
};

export type AthletePresetCoreInferResult = {
  weSeeYou: string;
  barriers: string[];
  progressionAggressiveness: ProgressionAggressiveness;
  peakLongRunPoolMiles: number;
  baseLongRunPoolMiles: number;
  taperLongRunPoolMiles: number;
  longestSaturdayMiles: number;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
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

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
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

function inferElitePeakPool(input: AthletePresetCoreInferInput): boolean {
  const lr = input.longRunCapabilityMiles ?? 0;
  const weekly = input.weeklyMileage;
  if (input.fitnessPhase === "PEAK" && (weekly >= 55 || lr >= 18)) return true;
  if (lr >= 20 || weekly >= 60) return true;
  const history = input.trainingHistory.toLowerCase();
  if (/\b(elite|sub-?3|boston|qualif|advanced|high volume)\b/.test(history)) return true;
  return false;
}

function scienceWeeklyRange(weekly: number, aggressiveness: ProgressionAggressiveness) {
  const floor = Math.max(20, Math.round(weekly * 0.85));
  const slack = aggressiveness === "AMBITIOUS" ? 8 : aggressiveness === "CONSERVATIVE" ? 3 : 5;
  const max = Math.round(weekly + slack);
  return { minWeeklyMiles: floor, maxWeeklyMiles: max };
}

function fallbackCoreInfer(input: AthletePresetCoreInferInput): AthletePresetCoreInferResult {
  const weekly = input.weeklyMileage;
  const elite = inferElitePeakPool(input);
  const aggressiveness: ProgressionAggressiveness =
    input.fitnessPhase === "PEAK" ? "MODERATE" : "CONSERVATIVE";
  const peakTarget = elite ? 65 : 55;
  const peak = clampPeakLongRunPoolToBand(peakTarget, elite);
  const cups = normalizeLongRunPools({
    baseLongRunPoolMiles: Math.max(30, Math.round(peak * 0.65)),
    peakLongRunPoolMiles: peak,
    taperLongRunPoolMiles: Math.max(25, Math.round(peak * 0.85)),
  });
  const calendar = computeCoreVolumeCalendarPreview({
    planStartDate: new Date(input.planStartDate),
    raceDate: new Date(input.raceDate),
    ...cups,
  });
  const lrCap = input.longRunCapabilityMiles;
  const longestSaturdayMiles =
    lrCap != null && lrCap > 0
      ? lrCap
      : Math.round(cups.peakLongRunPoolMiles * 0.28 * 10) / 10;
  const weeklyRange = scienceWeeklyRange(weekly, aggressiveness);
  const peakSat =
    calendar.peakPoolKey.length > 0
      ? Math.max(...calendar.peakPoolKey.map((s) => s.miles))
      : longestSaturdayMiles;

  return {
    weSeeYou: `You're running about ${weekly} miles per week heading into ${input.raceName}. We'll build a ${cups.peakLongRunPoolMiles}-mile peak long-run pool (four Saturdays) with your biggest Saturday around ${peakSat} mi.`,
    barriers: [],
    progressionAggressiveness: aggressiveness,
    peakLongRunPoolMiles: cups.peakLongRunPoolMiles,
    baseLongRunPoolMiles: cups.baseLongRunPoolMiles,
    taperLongRunPoolMiles: cups.taperLongRunPoolMiles,
    longestSaturdayMiles,
    minWeeklyMiles: weeklyRange.minWeeklyMiles,
    maxWeeklyMiles: weeklyRange.maxWeeklyMiles,
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

  const systemPrompt = `You are inferring a standard peak long-run POOL and weekly range a coach would defend for one athlete.

CRITICAL: peakLongRunPoolMiles is the SUM of four Saturday long runs in the peak 4-week block — NOT weekly mileage.
Example marathon peak pool ~70 mi might be four Saturdays: 19.6 + 19.6 + 21 + 9.8.

Peak pool bands (peakLongRunPoolMiles only):
- NORMAL ambition: 50–60 total pool miles
- ELITE ambition (high volume, sub-3 goals, 18+ mi long runs): 60–70 total pool miles

baseLongRunPoolMiles and taperLongRunPoolMiles are smaller 4-Saturday pool totals for build and taper blocks.

Weekly fields (minWeeklyMiles, maxWeeklyMiles) are separate — fitness floor + small slack (~3–8 mi above current weekly). Never set maxWeeklyMiles equal to peakLongRunPoolMiles.

longestSaturdayMiles = biggest single Saturday in the peak block (not the pool sum).

Infer ambition from free text (PR / crush / aggressive vs chill / just finish). Respect barriers: weekly vs longest Saturday, weeks left, speed vs endurance.

Rules:
- Do NOT pick cycle length or block count.
- Do NOT invent catalogue workouts.
- Do NOT output calendar dates.
- Athlete never picks aggressiveness — you infer progressionAggressiveness.
- Return JSON only with this shape:
{
  "weSeeYou": "one breath: what we heard + ambition + limiter + Saturday peak",
  "barriers": ["string"],
  "progressionAggressiveness": "CONSERVATIVE" | "MODERATE" | "AMBITIOUS",
  "peakLongRunPoolMiles": number,
  "baseLongRunPoolMiles": number,
  "taperLongRunPoolMiles": number,
  "longestSaturdayMiles": number,
  "minWeeklyMiles": number,
  "maxWeeklyMiles": number | null
}`;

  const userPayload = {
    fitnessPhase: input.fitnessPhase,
    trainingHistory: input.trainingHistory,
    ageYears: input.ageYears,
    gender: input.gender,
    weeklyMileage: input.weeklyMileage,
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
    const aggressiveness = parseAggressiveness(parsed.progressionAggressiveness);
    const elite = inferElitePeakPool(input);

    let peakRaw = Number(parsed.peakLongRunPoolMiles);
    if (!Number.isFinite(peakRaw) || peakRaw <= 0) {
      peakRaw = elite ? 65 : 55;
    }
    peakRaw = clampPeakLongRunPoolToBand(peakRaw, elite);

    const cups = normalizeLongRunPools({
      baseLongRunPoolMiles: parsed.baseLongRunPoolMiles as number,
      peakLongRunPoolMiles: peakRaw,
      taperLongRunPoolMiles: parsed.taperLongRunPoolMiles as number,
    });

    const calendar = computeCoreVolumeCalendarPreview({
      planStartDate: new Date(input.planStartDate),
      raceDate: new Date(input.raceDate),
      ...cups,
    });

    const fallbackWeekly = scienceWeeklyRange(input.weeklyMileage, aggressiveness);
    const maxRaw = parsed.maxWeeklyMiles;
    const maxWeeklyMiles =
      maxRaw === null
        ? fallbackWeekly.maxWeeklyMiles
        : clampInt(maxRaw, fallbackWeekly.minWeeklyMiles, 100, fallbackWeekly.maxWeeklyMiles);

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
      peakLongRunPoolMiles: cups.peakLongRunPoolMiles,
      baseLongRunPoolMiles: cups.baseLongRunPoolMiles,
      taperLongRunPoolMiles: cups.taperLongRunPoolMiles,
      longestSaturdayMiles: clampFloat(
        parsed.longestSaturdayMiles,
        6,
        30,
        input.longRunCapabilityMiles ?? peakSatFromKey
      ),
      minWeeklyMiles: clampInt(
        parsed.minWeeklyMiles,
        15,
        90,
        fallbackWeekly.minWeeklyMiles
      ),
      maxWeeklyMiles,
      cups,
      calendar,
    };
  } catch (e) {
    console.error("inferAthletePresetCore:", e);
    return fallbackCoreInfer(input);
  }
}

/** @deprecated use normalizeLongRunPools */
export const normalizeCoreVolumeCups = normalizeLongRunPools;
