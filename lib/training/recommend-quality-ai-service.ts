/**
 * AI quality catalogue recommender — creates 3–4 new athlete-owned workouts
 * that complement the existing staff + athlete catalogue (catalogue-aware).
 */

import { prisma } from "@/lib/prisma";
import {
  athleteCatalogueBrowseSelect,
  createAthleteCatalogueWorkout,
} from "@/lib/training/athlete-catalogue-create";
import { normalizeCatalogueAiFields } from "@/lib/training/catalogue-ai-parse";
import type { WeeklyVolumeBand } from "@/lib/training/weekly-volume-key";

export type RecommendQualityInput = {
  presetId: string;
  athleteId: string;
  workoutType: "Tempo" | "Intervals";
};

export type RecommendQualityCreatedItem = {
  id: string;
  name: string;
  description: string | null;
  workoutType: string;
  workBaseReps: number | null;
  workBaseRepMeters: number | null;
  ownerAthleteId: string | null;
  recoveryDistanceMeters: number | null;
  recoveryDurationSeconds: number | null;
  warmupMiles: number | null;
  cooldownMiles: number | null;
  warmupPaceOffsetSecPerMile: number | null;
  cooldownPaceOffsetSecPerMile: number | null;
  workBaseMiles: number | null;
  workPaceOffsetSecPerMile: number | null;
  workBasePaceOffsetSecPerMile: number | null;
};

export type RecommendQualityResult = {
  created: RecommendQualityCreatedItem[];
  source: "ai";
};

const RECOMMEND_CREATE_COUNT = 4;
const RECOMMEND_CREATE_COUNT_CONSERVATIVE = 3;

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

function targetCreateCount(
  weeklyVolumeBand: WeeklyVolumeBand | null | undefined,
  progressionAggressiveness: string | null | undefined
): number {
  const band = weeklyVolumeBand;
  const agg = (progressionAggressiveness ?? "MODERATE").toUpperCase();
  if (band === "FINISH" || agg === "CONSERVATIVE") return RECOMMEND_CREATE_COUNT_CONSERVATIVE;
  return RECOMMEND_CREATE_COUNT;
}

function normalizeProposedEntry(
  raw: Record<string, unknown>,
  workoutType: "Tempo" | "Intervals"
): { name: string; parsedFields: Record<string, unknown> } | null {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return null;

  const payload =
    raw.draftCataloguePayload && typeof raw.draftCataloguePayload === "object"
      ? (raw.draftCataloguePayload as Record<string, unknown>)
      : { ...raw };

  delete payload.id;
  delete payload.ownerAthleteId;

  const merged = normalizeCatalogueAiFields({
    ...payload,
    name,
    workoutType,
    description:
      typeof raw.description === "string"
        ? raw.description.trim() || null
        : typeof payload.description === "string"
          ? payload.description
          : null,
  });

  if (Array.isArray(raw.trainingIntent) && raw.trainingIntent.length) {
    merged.trainingIntent = raw.trainingIntent;
  }

  return { name, parsedFields: merged };
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

  const createCount = targetCreateCount(weeklyVolumeBand, progressionAggressiveness);

  const catalogueRows = await prisma.workout_catalogue.findMany({
    where: {
      workoutType: input.workoutType,
      OR: [{ ownerAthleteId: null }, { ownerAthleteId: input.athleteId }],
    },
    orderBy: [{ ownerAthleteId: "asc" }, { name: "asc" }],
    select: athleteCatalogueBrowseSelect,
  });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("AI recommendations are unavailable — try creating your own workout below");
  }

  let goalTime: string | null = null;
  if (preset.raceDateSnapshot) {
    const race = await prisma.athlete_races.findFirst({
      where: {
        athleteId: input.athleteId,
        raceDate: preset.raceDateSnapshot,
      },
      select: { goalTime: true, distanceLabel: true },
      orderBy: { updatedAt: "desc" },
    });
    goalTime = race?.goalTime?.trim() || null;
  }

  const raceDistanceLabel = preset.sourcePreset?.targetDistanceLabel?.trim() || null;

  const systemPrompt = `You are a running coach creating NEW workout catalogue entries for an athlete's training preset.

The athlete will mix these with existing staff catalogue workouts — do NOT duplicate names or structures already in the catalogue list.

Output JSON:
{
  "proposedEntries": [
    {
      "name": string,
      "description": string | null,
      "rationale": string,
      "draftCataloguePayload": { ... full catalogue row fields ... }
    }
  ],
  "warnings": string[]
}

Rules:
- Propose exactly ${createCount} NEW ${input.workoutType} workouts tailored to the athlete profile.
- draftCataloguePayload must use catalogue ai-parse field conventions (warmupMiles, workBaseMiles, workBaseReps, segmentPaceDist, pace offsets in sec/mi vs 5K, etc.).
- workoutType must be "${input.workoutType}" for every entry.
- Do NOT invent database IDs. Do NOT copy existing catalogue names verbatim.
- Complement gaps in the catalogue — e.g. if staff has steady tempo and rolling 400s, propose 2-1-2 tempo, longer sustained blocks, or pyramid intervals the athlete doesn't already have.
- Elite/ambitious athletes can get more aggressive structures; finish/conservative athletes get simpler progressions.
- paceAnchor: "currentBuildup" unless marathon-pace tempo is clearly appropriate.`;

  const userPayload = {
    workoutType: input.workoutType,
    targetCount: createCount,
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
    existingCatalogue: catalogueRows.map((c) => ({
      name: c.name,
      description: c.description,
      isStaff: c.ownerAthleteId == null,
      workBaseReps: c.workBaseReps,
      workBaseRepMeters: c.workBaseRepMeters,
      workBaseMiles: c.workBaseMiles,
      warmupMiles: c.warmupMiles,
      cooldownMiles: c.cooldownMiles,
      warmupPaceOffsetSecPerMile: c.warmupPaceOffsetSecPerMile,
      cooldownPaceOffsetSecPerMile: c.cooldownPaceOffsetSecPerMile,
      workPaceOffsetSecPerMile: c.workPaceOffsetSecPerMile,
      workBasePaceOffsetSecPerMile: c.workBasePaceOffsetSecPerMile,
    })),
  };

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
    console.error(
      "recommendQualityCatalogueForPreset OpenAI HTTP",
      res.status,
      await res.text()
    );
    throw new Error("Could not generate recommendations — try again or create your own");
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJsonObject(content) as { proposedEntries?: unknown[] };
  const rawEntries = Array.isArray(parsed.proposedEntries) ? parsed.proposedEntries : [];

  const normalized = rawEntries
    .filter((e): e is Record<string, unknown> => e != null && typeof e === "object")
    .map((e) => normalizeProposedEntry(e, input.workoutType))
    .filter((e): e is { name: string; parsedFields: Record<string, unknown> } => e != null)
    .slice(0, createCount);

  if (normalized.length === 0) {
    throw new Error("AI did not return valid workouts — try again or create your own");
  }

  const existingNames = new Set(
    catalogueRows
      .filter((c) => c.ownerAthleteId === input.athleteId)
      .map((c) => c.name.toLowerCase())
  );

  const created: RecommendQualityCreatedItem[] = [];

  for (const entry of normalized) {
    let name = entry.name;
    let suffix = 2;
    while (existingNames.has(name.toLowerCase())) {
      name = `${entry.name} (${suffix})`;
      suffix += 1;
    }
    existingNames.add(name.toLowerCase());

    try {
      const item = await createAthleteCatalogueWorkout({
        athleteId: input.athleteId,
        name,
        description:
          typeof entry.parsedFields.description === "string"
            ? entry.parsedFields.description
            : null,
        workoutType: input.workoutType,
        parsedFields: { ...entry.parsedFields, name },
      });
      created.push(item);
    } catch (e) {
      console.error("recommendQualityCatalogueForPreset create failed", name, e);
    }
  }

  if (created.length === 0) {
    throw new Error("Could not save recommended workouts — try creating your own");
  }

  return { created, source: "ai" };
}
