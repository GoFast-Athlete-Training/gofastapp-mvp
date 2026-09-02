/**
 * Always seed a spawned workouts row for a finished Garmin activity (surfacing path).
 * Skips nearby-planned blocking — product needs a workoutId even when plan snap is pending.
 */

import { prisma } from "@/lib/prisma";
import { RUNNING_ACTIVITY_TYPES } from "@/lib/training/activity-type-sets";

function speedMpsToSecPerMile(mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0) return null;
  return Math.round(1609.34 / mps);
}

function isRunningActivityType(activityType: string | null | undefined): boolean {
  if (!activityType) return true;
  return RUNNING_ACTIVITY_TYPES.has(activityType.toUpperCase());
}

export async function seedSpawnedWorkoutFromActivity(
  athleteActivityId: string
): Promise<{ workoutId: string | null; alreadyLinked?: boolean }> {
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: athleteActivityId },
  });
  if (!activity?.startTime || !isRunningActivityType(activity.activityType)) {
    return { workoutId: null };
  }

  const existing = await prisma.workouts.findFirst({
    where: { garminDetailActivityId: activity.id },
    select: { id: true },
  });
  if (existing) {
    return { workoutId: existing.id, alreadyLinked: true };
  }

  const summaryBlob =
    activity.summaryData != null && typeof activity.summaryData === "object"
      ? (activity.summaryData as Record<string, unknown>)
      : null;
  const titleBase = (activity.activityName ?? "Recorded run").trim().slice(0, 200);
  const title = titleBase.length > 0 ? titleBase : "Recorded run";
  const distanceMeters =
    activity.distance != null && activity.distance > 0 ? activity.distance : null;
  const paceSecPerMile = speedMpsToSecPerMile(activity.averageSpeed);

  const created = await prisma.workouts.create({
    data: {
      title,
      workoutType: "Easy",
      description: null,
      athleteId: activity.athleteId,
      planId: null,
      date: activity.startTime,
      catalogueWorkoutId: null,
      garminDetailActivityId: activity.id,
      estimatedDistanceInMeters: distanceMeters,
      actualDistanceMeters: distanceMeters,
      actualAvgPaceSecPerMile: paceSecPerMile,
      actualAverageHeartRate: activity.averageHeartRate,
      actualDurationSeconds: activity.duration,
      actualMaxHeartRate: activity.maxHeartRate,
      actualElevationGain: activity.elevationGain,
      actualCalories: activity.calories,
      actualSteps: activity.steps,
      completedActivitySummaryJson:
        summaryBlob != null ? (summaryBlob as object) : undefined,
    },
    select: { id: true },
  });

  await prisma.athlete_activities.update({
    where: { id: athleteActivityId },
    data: { ingestionStatus: "MATCHED" },
  });

  return { workoutId: created.id };
}
