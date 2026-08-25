/**
 * First OpenAI prompt for athlete Create my own — infers cups + ambition from free text.
 */

import type { AthletePresetFitnessPhase, ProgressionAggressiveness } from "@prisma/client";
import {
  computeCoreVolumeCalendarPreview,
  normalizeCoreVolumeCups,
} from "@/lib/training/core-volume-compute";

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
  peakLrPoolMax: number;
  baseLrPool: number;
  taperLrPool: number;
  longestSaturdayMiles: number;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  cups: { baseMiles: number; peakMiles: number; taperMiles: number };
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

function fallbackCoreInfer(input: AthletePresetCoreInferInput): AthletePresetCoreInferResult {
  const weekly = input.weeklyMileage;
  const peak =
    input.fitnessPhase === "PEAK"
      ? Math.max(44, Math.min(75, weekly + 10))
      : Math.max(40, Math.min(65, Math.round(weekly * 1.1)));
  const base = Math.max(30, Math.round(peak * 0.65));
  const taper = Math.max(25, Math.round(peak * 0.85));
  const cups = normalizeCoreVolumeCups({
    baseLrPool: base,
    peakLrPoolMax: peak,
    taperLrPool: taper,
  });
  const calendar = computeCoreVolumeCalendarPreview({
    planStartDate: new Date(input.planStartDate),
    raceDate: new Date(input.raceDate),
    ...cups,
  });
  return {
    weSeeYou: `You're running about ${weekly} miles per week heading into ${input.raceName}. We'll build toward a ${cups.peakMiles}-mile long-run block with a peak Saturday around week ${calendar.peakWeekNumber ?? "race"}.`,
    barriers: [],
    progressionAggressiveness: "MODERATE",
    peakLrPoolMax: cups.peakMiles,
    baseLrPool: cups.baseMiles,
    taperLrPool: cups.taperMiles,
    longestSaturdayMiles: Math.round(cups.peakMiles * 0.3 * 10) / 10,
    minWeeklyMiles: Math.max(25, base),
    maxWeeklyMiles: peak,
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

  const systemPrompt = `You are inferring a standard peak long-run pool and weekly range a coach would defend for one athlete.

Infer ambition from their free text (PR / crush / aggressive vs chill / just finish). Land cups that match that ambition while respecting barriers (weekly mileage vs longest Saturday, weeks left, speed vs endurance).

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
  "peakLrPoolMax": number,
  "baseLrPool": number,
  "taperLrPool": number,
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

    const cups = normalizeCoreVolumeCups({
      baseLrPool: parsed.baseLrPool as number,
      peakLrPoolMax: parsed.peakLrPoolMax as number,
      taperLrPool: parsed.taperLrPool as number,
    });

    const calendar = computeCoreVolumeCalendarPreview({
      planStartDate: new Date(input.planStartDate),
      raceDate: new Date(input.raceDate),
      ...cups,
    });

    const maxRaw = parsed.maxWeeklyMiles;
    const maxWeeklyMiles =
      maxRaw === null ? null : clampInt(maxRaw, cups.baseMiles, 100, cups.peakMiles);

    return {
      weSeeYou:
        typeof parsed.weSeeYou === "string" && parsed.weSeeYou.trim()
          ? parsed.weSeeYou.trim()
          : fallbackCoreInfer(input).weSeeYou,
      barriers: Array.isArray(parsed.barriers)
        ? parsed.barriers.filter((b): b is string => typeof b === "string").slice(0, 6)
        : [],
      progressionAggressiveness: parseAggressiveness(parsed.progressionAggressiveness),
      peakLrPoolMax: cups.peakMiles,
      baseLrPool: cups.baseMiles,
      taperLrPool: cups.taperMiles,
      longestSaturdayMiles: clampFloat(parsed.longestSaturdayMiles, 6, 30, cups.peakMiles * 0.3),
      minWeeklyMiles: clampInt(parsed.minWeeklyMiles, 15, 90, Math.max(25, cups.baseMiles)),
      maxWeeklyMiles,
      cups,
      calendar,
    };
  } catch (e) {
    console.error("inferAthletePresetCore:", e);
    return fallbackCoreInfer(input);
  }
}
