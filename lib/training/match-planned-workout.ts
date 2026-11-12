/**
 * Match activity to planned_workout → spawn instance → bolt laps.
 */

import { prisma } from "@/lib/prisma";
import type { ActivityForWorkoutApply } from "./apply-activity-to-workout";
import { applyActivityToWorkout } from "./apply-activity-to-workout";
import { loadPlannedWorkoutForSpawn } from "./spawn-workout-from-planned";
import { seedSpawnedWorkoutFromActivity } from "./seed-spawned-workout-from-activity";
import {
  loadWorkoutForApplyAfterStamp,
  reboltLapsAfterPlanStamp,
  stampPlanOntoWorkoutFromPlannedId,
} from "./stamp-plan-onto-workout";

async function resolveSpawnedWorkoutIdForActivity(
  activityId: string
): Promise<string> {
  const linked = await prisma.workouts.findFirst({
    where: { garminDetailActivityId: activityId },
    select: { id: true },
  });
  if (linked) return linked.id;
  const seeded = await seedSpawnedWorkoutFromActivity(activityId);
  if (!seeded.workoutId) {
    throw new Error("Could not spawn workout for activity");
  }
  return seeded.workoutId;
}

/** Stamp plan prescribe onto the spawned workout id, then link activity actuals. */
export async function applyActivityToPlannedWorkout(params: {
  plannedWorkoutId: string;
  activity: ActivityForWorkoutApply;
}): Promise<{ workoutId: string }> {
  const planned = await loadPlannedWorkoutForSpawn(params.plannedWorkoutId);
  if (!planned) {
    throw new Error("Planned workout not found");
  }
  const workoutId = await resolveSpawnedWorkoutIdForActivity(params.activity.id);
  await stampPlanOntoWorkoutFromPlannedId({
    workoutId,
    plannedWorkoutId: planned.id,
  });
  await reboltLapsAfterPlanStamp(workoutId);
  const workout = await loadWorkoutForApplyAfterStamp(workoutId);
  if (!workout) throw new Error("Workout missing after plan stamp");
  return applyActivityToWorkout({ workout, activity: params.activity });
}

/** Resolve spawned instance id for a planned day (spawn if needed, no activity link). */
export async function resolveSpawnedWorkoutForPlanned(
  plannedWorkoutId: string
): Promise<string> {
  const byPlan = await prisma.workouts.findFirst({
    where: {
      OR: [{ plannedWorkoutId }, { id: plannedWorkoutId }],
      planId: { not: null },
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });
  if (byPlan) return byPlan.id;
  return plannedWorkoutId;
}

/** Stamp plan onto the activity's spawned workout id (no id swap). */
export async function reassignActivityToPlannedWorkout(params: {
  activityId: string;
  plannedWorkoutId: string;
  athleteId: string;
}) {
  const activity = await prisma.athlete_activities.findFirst({
    where: { id: params.activityId, athleteId: params.athleteId },
  });
  if (!activity) throw new Error("Activity not found");

  const workoutId = await resolveSpawnedWorkoutIdForActivity(params.activityId);
  await stampPlanOntoWorkoutFromPlannedId({
    workoutId,
    plannedWorkoutId: params.plannedWorkoutId,
  });
  await reboltLapsAfterPlanStamp(workoutId);
  const workout = await loadWorkoutForApplyAfterStamp(workoutId);
  if (!workout) throw new Error("Workout missing after plan stamp");

  const apply = await applyActivityToWorkout({
    workout,
    activity: {
      id: activity.id,
      athleteId: activity.athleteId,
      distance: activity.distance,
      averageSpeed: activity.averageSpeed,
      averageHeartRate: activity.averageHeartRate,
      duration: activity.duration,
      maxHeartRate: activity.maxHeartRate,
      elevationGain: activity.elevationGain,
      calories: activity.calories,
      steps: activity.steps,
      summaryData: activity.summaryData,
      detailData: activity.detailData,
    },
  });
  return { success: true as const, workoutId: apply.workoutId };
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
      garminDetailActivityId: { not: null },
    },
    select: { garminDetailActivityId: true },
  });
  return Boolean(row && row.garminDetailActivityId !== params.activityId);
}
