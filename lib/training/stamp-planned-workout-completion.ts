/**
 * Stamp planned_workouts when a workouts row bolts onto a planned day.
 * Home / Runner / Training read workoutId + workoutCompleted — not live joins.
 */

import { prisma } from "@/lib/prisma";

/** Resolve the planned_workouts row id for a spawned / same-id workout instance. */
export async function resolvePlannedWorkoutIdForWorkout(
  workoutId: string
): Promise<string | null> {
  const workout = await prisma.workouts.findUnique({
    where: { id: workoutId },
    select: { id: true, plannedWorkoutId: true, planId: true },
  });
  if (!workout?.planId) return null;

  if (workout.plannedWorkoutId) {
    return workout.plannedWorkoutId;
  }

  const sameIdPlanned = await prisma.planned_workouts.findUnique({
    where: { id: workout.id },
    select: { id: true, planId: true },
  });
  if (sameIdPlanned?.planId) {
    return sameIdPlanned.id;
  }

  return null;
}

/** After activity apply / reassign onto a plan-linked workout. */
export async function stampPlannedWorkoutCompletion(
  workoutId: string
): Promise<void> {
  const plannedWorkoutId = await resolvePlannedWorkoutIdForWorkout(workoutId);
  if (!plannedWorkoutId) return;

  await prisma.planned_workouts.update({
    where: { id: plannedWorkoutId },
    data: {
      workoutId,
      workoutCompleted: true,
      updatedAt: new Date(),
    },
  });
}

/** After unlink / clear from a plan-linked workout. */
export async function clearPlannedWorkoutCompletion(
  workoutId: string
): Promise<void> {
  const plannedWorkoutId = await resolvePlannedWorkoutIdForWorkout(workoutId);
  if (!plannedWorkoutId) return;

  await prisma.planned_workouts.updateMany({
    where: {
      id: plannedWorkoutId,
      workoutId,
    },
    data: {
      workoutId: null,
      workoutCompleted: false,
      updatedAt: new Date(),
    },
  });
}
