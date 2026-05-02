/**
 * When a running activity does not match a planned workout, promote it to a canonical
 * standalone `workouts` row so volume and downstream analysis are not lost.
 */

import { prisma } from "@/lib/prisma";
import { RUNNING_ACTIVITY_TYPES } from "@/lib/training/activity-type-sets";

/** m/s → seconds per mile */
function speedMpsToSecPerMile(mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0) return null;
  return Math.round(1609.34 / mps);
}

function isRunningActivityType(activityType: string | null | undefined): boolean {
  if (!activityType) return true;
  return RUNNING_ACTIVITY_TYPES.has(activityType.toUpperCase());
}

export async function promoteUnmatchedRunningActivityToWorkout(
  athleteActivityId: string
): Promise<{ promoted: boolean; workoutId?: string; alreadyLinked?: boolean }> {
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: athleteActivityId },
  });
  if (!activity?.startTime) {
    return { promoted: false };
  }

  if (!isRunningActivityType(activity.activityType)) {
    return { promoted: false };
  }

  if (activity.ingestionStatus === "INELIGIBLE") {
    return { promoted: false };
  }

  const existing = await prisma.workouts.findFirst({
    where: { matchedActivityId: activity.id },
    select: { id: true },
  });
  if (existing) {
    await prisma.athlete_activities.update({
      where: { id: athleteActivityId },
      data: { ingestionStatus: "MATCHED" },
    });
    return { promoted: true, workoutId: existing.id, alreadyLinked: true };
  }

  const titleBase = (activity.activityName ?? "Recorded run").trim().slice(0, 200);
  const title = titleBase.length > 0 ? titleBase : "Recorded run";
  const distanceMeters =
    activity.distance != null && activity.distance > 0 ? activity.distance : null;
  const paceSecPerMile = speedMpsToSecPerMile(activity.averageSpeed);
  const summary = activity.summaryData;

  const created = await prisma.workouts.create({
    data: {
      title,
      workoutType: "Easy",
      description: null,
      athleteId: activity.athleteId,
      planId: null,
      date: activity.startTime,
      catalogueWorkoutId: null,
      matchedActivityId: activity.id,
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
        summary != null ? (summary as object) : undefined,
    },
  });

  await prisma.athlete_activities.update({
    where: { id: athleteActivityId },
    data: { ingestionStatus: "MATCHED" },
  });

  return { promoted: true, workoutId: created.id };
}
