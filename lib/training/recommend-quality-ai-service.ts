/**
 * AI quality catalogue recommender — uses persisted athlete preset + catalogue rows.
 * Falls back to local name/volume scorer when OpenAI fails.
 */

import { prisma } from "@/lib/prisma";
import { CATALOGUE_ROTATION_SLOTS } from "@/lib/training/athlete-rotation-constants";
import {
  recommendQualityCatalogueIds,
  type CatalogueRecommendRow,
} from "@/lib/training/recommend-quality-catalogue";
import type { WeeklyVolumeBand } from "@/lib/training/weekly-volume-key";

export type RecommendQualityInput = {
  presetId: string;
  athleteId: string;
  workoutType: "Tempo" | "Intervals";
  templateSeedIds?: string[];
};

export type RecommendQualityResult = {
  catalogueIds: string[];
  source: "ai" | "fallback";
};

function overviewField(overview: unknown, key: string): unknown {
  if (overview == null || typeof overview !== "object" || Array.isArray(overview)) {
    return undefined;
  }
  return (overview as Record<string, unknown>)[key];
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

function targetPickCount(
  weeklyVolumeBand: WeeklyVolumeBand | null | undefined,
  progressionAggressiveness: string | null | undefined,
  templateSeedIds: string[]
): number {
  const band = weeklyVolumeBand;
  const agg = (progressionAggressiveness ?? "MODERATE").toUpperCase();

  if (band === "ELITE" || agg === "AMBITIOUS") return CATALOGUE_ROTATION_SLOTS;
  if (band === "FINISH" || agg === "CONSERVATIVE") {
    const templateLen = templateSeedIds.filter(Boolean).length;
    return Math.min(CATALOGUE_ROTATION_SLOTS, Math.max(4, templateLen || 4));
  }
  const templateLen = templateSeedIds.filter(Boolean).length;
  return Math.min(CATALOGUE_ROTATION_SLOTS, Math.max(templateLen || 6, 6));
}

async function loadTemplateSeedIds(
  sourcePresetId: string | null,
  workoutType: "Tempo" | "Intervals"
): Promise<string[]> {
  if (!sourcePresetId) return [];

  const source = await prisma.training_plan_preset.findUnique({
    where: { id: sourcePresetId },
    select: {
      tempoConfig: {
        select: {
          positions: {
            orderBy: { cyclePosition: "asc" },
            select: { catalogueWorkoutId: true },
          },
        },
      },
      intervalsConfig: {
        select: {
          positions: {
            orderBy: { cyclePosition: "asc" },
            select: { catalogueWorkoutId: true },
          },
        },
      },
    },
  });

  const positions =
    workoutType === "Tempo"
      ? source?.tempoConfig?.positions
      : source?.intervalsConfig?.positions;

  return (positions ?? [])
    .map((p) => p.catalogueWorkoutId?.trim())
    .filter((id): id is string => Boolean(id));
}

export async function recommendQualityCatalogueForPreset(
  input: RecommendQualityInput
): Promise<RecommendQualityResult> {
  const preset = await prisma.athlete_presets.findFirst({
    where: { id: input.presetId, athleteId: input.athleteId },
    select: {
      trainingHistory: true,
      fitnessPhase: true,
      progressionAggressiveness: true,
      coachPlanOverview: true,
      baseLongRunPoolMiles: true,
      peakLongRunPoolMiles: true,
      taperLongRunPoolMiles: true,
      minWeeklyMiles: true,
      maxWeeklyMiles: true,
      raceDateSnapshot: true,
      sourcePresetId: true,
      sourcePreset: { select: { targetDistanceLabel: true } },
      athlete: {
        select: {
          fiveKPace: true,
          longRunCapabilityMiles: true,
        },
      },
    },
  });

  if (!preset) {
    throw new Error("Athlete preset not found");
  }

  const overview = preset.coachPlanOverview;
  const weeklyVolumeBand = overviewField(overview, "weeklyVolumeBand") as
    | WeeklyVolumeBand
    | null
    | undefined;
  const weSeeYou = overviewField(overview, "weSeeYou");
  const progressionAggressiveness =
    preset.progressionAggressiveness ??
    (typeof overviewField(overview, "progressionAggressiveness") === "string"
      ? (overviewField(overview, "progressionAggressiveness") as string)
      : "MODERATE");

  const templateSeedIds =
    input.templateSeedIds?.filter(Boolean) ??
    (await loadTemplateSeedIds(preset.sourcePresetId, input.workoutType));

  const catalogueRows = await prisma.workout_catalogue.findMany({
    where: {
      workoutType: input.workoutType,
      OR: [{ ownerAthleteId: null }, { ownerAthleteId: input.athleteId }],
    },
    orderBy: [{ ownerAthleteId: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      workBaseReps: true,
      workBaseRepMeters: true,
      workBaseMiles: true,
      warmupMiles: true,
      cooldownMiles: true,
    },
  });

  const catalogue: CatalogueRecommendRow[] = catalogueRows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    workBaseReps: r.workBaseReps,
    workBaseRepMeters: r.workBaseRepMeters,
  }));

  const fallbackInput = {
    catalogue,
    templateSeedIds,
    weeklyVolumeBand,
    progressionAggressiveness,
  };

  const fallbackIds = recommendQualityCatalogueIds(fallbackInput);
  const targetCount = targetPickCount(
    weeklyVolumeBand,
    progressionAggressiveness,
    templateSeedIds
  );

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || catalogue.length === 0) {
    return { catalogueIds: fallbackIds, source: "fallback" };
  }

  let goalTime: string | null = null;
  if (preset.raceDateSnapshot) {
    const race = await prisma.athlete_races.findFirst({
      where: {
        athleteId: input.athleteId,
        raceDate: preset.raceDateSnapshot,
      },
      select: { goalTime: true, distanceLabel: true, goalDistance: true },
      orderBy: { updatedAt: "desc" },
    });
    goalTime = race?.goalTime?.trim() || null;
  }

  const raceDistanceLabel =
    preset.sourcePreset?.targetDistanceLabel?.trim() || null;

  const systemPrompt = `You are a running coach selecting quality workouts from a catalogue for an athlete's training preset.

Given the athlete profile and catalogue list, return JSON: { "catalogueIds": string[] }

Rules:
- Pick ${targetCount} to ${CATALOGUE_ROTATION_SLOTS} workouts (prefer ${targetCount} for conservative/finish bands; up to ${CATALOGUE_ROTATION_SLOTS} for elite/ambitious).
- catalogueIds must be exact IDs from the provided catalogue only.
- Prefer template seed IDs when they fit the athlete; add variety for ambitious/elite athletes (e.g. 2-1-2 tempo, rolling 400s, longer sustained work).
- Match workoutType "${input.workoutType}" only — every ID must be from that list.
- Do not invent IDs.`;

  const userPayload = {
    workoutType: input.workoutType,
    athlete: {
      trainingHistory: preset.trainingHistory,
      fitnessPhase: preset.fitnessPhase,
      progressionAggressiveness,
      weeklyVolumeBand: weeklyVolumeBand ?? null,
      weSeeYou: typeof weSeeYou === "string" ? weSeeYou : null,
      goalTime,
      raceDistanceLabel,
      fiveKPace: preset.athlete.fiveKPace,
      longRunCapabilityMiles: preset.athlete.longRunCapabilityMiles,
      cups: {
        baseLongRunPoolMiles: preset.baseLongRunPoolMiles,
        peakLongRunPoolMiles: preset.peakLongRunPoolMiles,
        taperLongRunPoolMiles: preset.taperLongRunPoolMiles,
      },
      weeklyMiles: {
        min: preset.minWeeklyMiles,
        max: preset.maxWeeklyMiles,
      },
    },
    templateSeedIds,
    catalogue: catalogueRows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      workBaseReps: c.workBaseReps,
      workBaseRepMeters: c.workBaseRepMeters,
      workBaseMiles: c.workBaseMiles,
      warmupMiles: c.warmupMiles,
      cooldownMiles: c.cooldownMiles,
    })),
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
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error(
        "recommendQualityCatalogueForPreset OpenAI HTTP",
        res.status,
        await res.text()
      );
      return { catalogueIds: fallbackIds, source: "fallback" };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = extractJsonObject(content) as { catalogueIds?: unknown };
    const validIds = new Set(catalogue.map((c) => c.id));
    const rawIds = Array.isArray(parsed.catalogueIds) ? parsed.catalogueIds : [];
    const filtered = rawIds
      .filter((id): id is string => typeof id === "string" && validIds.has(id))
      .slice(0, CATALOGUE_ROTATION_SLOTS);

    if (filtered.length === 0) {
      return { catalogueIds: fallbackIds, source: "fallback" };
    }

    return { catalogueIds: filtered, source: "ai" };
  } catch (e) {
    console.error("recommendQualityCatalogueForPreset", e);
    return { catalogueIds: fallbackIds, source: "fallback" };
  }
}
