import type { WorkoutType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { newEntityId } from "@/lib/training/new-entity-id";
import { PACE_ANCHOR_CURRENT_BUILDUP } from "@/lib/training/goal-pace-calculator";

const ALLOWED_TYPES = new Set<WorkoutType>(["Tempo", "Intervals"]);

export type CreateAthleteCatalogueInput = {
  athleteId: string;
  name: string;
  description?: string | null;
  workoutType: "Tempo" | "Intervals";
};

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
  const defaults = defaultFieldsForType(input.workoutType);
  const now = new Date();

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

  return prisma.workout_catalogue.create({
    data: {
      id: newEntityId(),
      name,
      description,
      workoutType: input.workoutType,
      ownerAthleteId: input.athleteId,
      paceAnchor: PACE_ANCHOR_CURRENT_BUILDUP,
      mpBlockProgression: "flat",
      updatedAt: now,
      ...defaults,
    },
    select: {
      id: true,
      name: true,
      description: true,
      workoutType: true,
      workBaseReps: true,
      workBaseRepMeters: true,
      ownerAthleteId: true,
    },
  });
}
