/**
 * Match activity to planned_workout → spawn instance → bolt laps.
 */

import { prisma } from "@/lib/prisma";
import type { ActivityForWorkoutApply } from "./apply-activity-to-workout";
import {
  applyActivityToWorkout,
  reassignActivityToWorkout,
} from "./apply-activity-to-workout";
import {
  findSpawnedInstanceForPlanned,
  loadPlannedWorkoutForSpawn,
  spawnWorkoutFromPlanned,
} from "./spawn-workout-from-planned";

export async function applyActivityToPlannedWorkout(params: {
  plannedWorkoutId: string;
  activity: ActivityForWorkoutApply;
}): Promise<{ workoutId: string }> {
  const planned = await loadPlannedWorkoutForSpawn(params.plannedWorkoutId);
  if (!planned) {
    throw new Error("Planned workout not found");
  }
  const spawned = await spawnWorkoutFromPlanned(planned);
  return applyActivityToWorkout({ workout: spawned, activity: params.activity });
}

/** Resolve spawned instance id for a planned day (spawn if needed, no activity link). */
export async function resolveSpawnedWorkoutForPlanned(
  plannedWorkoutId: string
): Promise<string> {
  const existing = await findSpawnedInstanceForPlanned({ plannedWorkoutId });
  if (existing) return existing.id;
  const planned = await loadPlannedWorkoutForSpawn(plannedWorkoutId);
  if (!planned) throw new Error("Planned workout not found");
  const spawned = await spawnWorkoutFromPlanned(planned);
  return spawned.id;
}

export async function reassignActivityToPlannedWorkout(params: {
  activityId: string;
  plannedWorkoutId: string;
  athleteId: string;
}) {
  const spawnedWorkoutId = await resolveSpawnedWorkoutForPlanned(params.plannedWorkoutId);
  return reassignActivityToWorkout({
    activityId: params.activityId,
    targetWorkoutId: spawnedWorkoutId,
    athleteId: params.athleteId,
  });
}

/** True when a planned day already has a different matched spawned instance. */
export async function plannedDayConsumedByOtherActivity(params: {
  plannedWorkoutId: string;
  activityId: string;
}): Promise<boolean> {
  const row = await prisma.workouts.findFirst({
    where: {
      OR: [
        { plannedWorkoutId: params.plannedWorkoutId },
        { id: params.plannedWorkoutId },
      ],
      matchedActivityId: { not: null },
    },
    select: { matchedActivityId: true },
  });
  return Boolean(row && row.matchedActivityId !== params.activityId);
}
