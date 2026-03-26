import type { WorkoutType, workout_catalogue } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Pick the next catalogue workout for plan materialization:
 * - If athlete has a completed workout of this type with a catalogue link, advance progressionIndex.
 * - Otherwise first entry for this type + phase (lowest progressionIndex).
 */
export async function selectNextCatalogueWorkout(
  athleteId: string,
  workoutType: WorkoutType,
  phase: string
): Promise<workout_catalogue | null> {
  const phaseNorm = phase.trim().toLowerCase();

  const lastDone = await prisma.workouts.findFirst({
    where: {
      athleteId,
      workoutType,
      catalogueWorkoutId: { not: null },
      matchedActivityId: { not: null },
    },
    orderBy: { date: "desc" },
    include: { workout_catalogue: true },
  });

  if (lastDone?.workout_catalogue) {
    const last = lastDone.workout_catalogue;
    const lastPhases = last.intendedPhase.map((p) => p.toLowerCase());
    const lastInCurrentPhase = lastPhases.includes(phaseNorm);

    if (lastInCurrentPhase) {
      const next = await prisma.workout_catalogue.findFirst({
        where: {
          workoutType,
          progressionIndex: { gt: last.progressionIndex },
          intendedPhase: { has: phaseNorm },
        },
        orderBy: { progressionIndex: "asc" },
      });
      if (next) return next;
    }

    // New phase or wrap: start (or restart) progression for this phase
    const firstOfPhase = await prisma.workout_catalogue.findFirst({
      where: {
        workoutType,
        intendedPhase: { has: phaseNorm },
      },
      orderBy: { progressionIndex: "asc" },
    });
    return firstOfPhase;
  }

  return prisma.workout_catalogue.findFirst({
    where: {
      workoutType,
      intendedPhase: { has: phaseNorm },
    },
    orderBy: { progressionIndex: "asc" },
  });
}
