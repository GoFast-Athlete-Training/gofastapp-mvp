import type { WorkoutType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bodyToCatalogueRow } from "@/lib/training/catalogue-row";
import { newEntityId } from "@/lib/training/new-entity-id";
import { PACE_ANCHOR_CURRENT_BUILDUP } from "@/lib/training/goal-pace-calculator";

const ALLOWED_TYPES = new Set<WorkoutType>(["Tempo", "Intervals"]);

export type CreateAthleteCatalogueInput = {
  athleteId: string;
  name: string;
  description?: string | null;
  workoutType: "Tempo" | "Intervals";
  /** Parsed catalogue fields from AI parse or bodyToCatalogueRow-compatible body. */
  parsedFields?: Record<string, unknown>;
};

export const athleteCatalogueBrowseSelect = {
  id: true,
  name: true,
  description: true,
  workoutType: true,
  workBaseReps: true,
  workBaseRepMeters: true,
  ownerAthleteId: true,
  recoveryDistanceMeters: true,
  recoveryDurationSeconds: true,
  warmupMiles: true,
  cooldownMiles: true,
  warmupPaceOffsetSecPerMile: true,
  cooldownPaceOffsetSecPerMile: true,
  workBaseMiles: true,
  workPaceOffsetSecPerMile: true,
  workBasePaceOffsetSecPerMile: true,
} as const;

export function defaultFieldsForType(workoutType: "Tempo" | "Intervals") {
  if (workoutType === "Tempo") {
    return {
      warmupMiles: 1.5,
      cooldownMiles: 1.0,
      workBaseMiles: 4.0,
      workPaceOffsetSecPerMile: 30,
      workBaseReps: null,
      workBaseRepMeters: null,
      recoveryDistanceMeters: null,
      workBasePaceOffsetSecPerMile: null,
    };
  }
  return {
    warmupMiles: 1.5,
    cooldownMiles: 1.5,
    workBaseReps: 6,
    workBaseRepMeters: 800,
    recoveryDistanceMeters: 400,
    workBasePaceOffsetSecPerMile: -30,
    workBaseMiles: null,
    workPaceOffsetSecPerMile: null,
  };
}

export async function createAthleteCatalogueWorkout(input: CreateAthleteCatalogueInput) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Workout name is required");
  }
  if (!ALLOWED_TYPES.has(input.workoutType)) {
    throw new Error("Only Tempo and Intervals workouts can be created here");
  }

  const description = input.description?.trim() || null;

  const existing = await prisma.workout_catalogue.findFirst({
    where: {
      name,
      workoutType: input.workoutType,
      ownerAthleteId: input.athleteId,
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error("You already have a workout with this name");
  }

  const now = new Date();
  let rowData: Record<string, unknown>;

  if (input.parsedFields && Object.keys(input.parsedFields).length > 0) {
    const merged = {
      ...input.parsedFields,
      name,
      workoutType: input.workoutType,
      description: description ?? input.parsedFields.description ?? null,
    };
    const parsed = bodyToCatalogueRow(merged);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    rowData = {
      ...parsed.data,
      ownerAthleteId: input.athleteId,
      updatedAt: now,
    };
  } else {
    const defaults = defaultFieldsForType(input.workoutType);
    rowData = {
      id: newEntityId(),
      name,
      description,
      workoutType: input.workoutType,
      ownerAthleteId: input.athleteId,
      paceAnchor: PACE_ANCHOR_CURRENT_BUILDUP,
      mpBlockProgression: "flat",
      updatedAt: now,
      ...defaults,
    };
  }

  if (!("id" in rowData) || !rowData.id) {
    rowData.id = newEntityId();
  }
  if (!("paceAnchor" in rowData) || !rowData.paceAnchor) {
    rowData.paceAnchor = PACE_ANCHOR_CURRENT_BUILDUP;
  }
  if (!("mpBlockProgression" in rowData) || !rowData.mpBlockProgression) {
    rowData.mpBlockProgression = "flat";
  }

  return prisma.workout_catalogue.create({
    data: rowData as Parameters<typeof prisma.workout_catalogue.create>[0]["data"],
    select: athleteCatalogueBrowseSelect,
  });
}
