/**
 * After a new athlete_activity is saved, try to match it to a plan workout
 * (same athlete, same calendar day UTC, plan workout not yet matched, running-like activity).
 */

import { prisma } from "@/lib/prisma";

/** m/s → seconds per mile */
function speedMpsToSecPerMile(mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0) return null;
  return Math.round(1609.34 / mps);
}

function utcDayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Match activity to at most one planned workout; promote summary fields onto workouts.
 */
export async function tryMatchActivityToTrainingWorkout(
  athleteActivityId: string
): Promise<{ matched: boolean; workoutId?: string }> {
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: athleteActivityId },
  });
  if (!activity?.startTime) {
    return { matched: false };
  }

  const { start, end } = utcDayBounds(activity.startTime);

  const candidate = await prisma.workouts.findFirst({
    where: {
      athleteId: activity.athleteId,
      planId: { not: null },
      date: { gte: start, lte: end },
      matchedActivityId: null,
    },
    orderBy: { date: "asc" },
  });

  if (!candidate) {
    return { matched: false };
  }

  const distanceMeters =
    activity.distance != null && activity.distance > 0
      ? activity.distance
      : null;

  const paceSecPerMile = speedMpsToSecPerMile(activity.averageSpeed);

  await prisma.workouts.update({
    where: { id: candidate.id },
    data: {
      matchedActivityId: activity.id,
      actualDistanceMeters: distanceMeters,
      actualAvgPaceSecPerMile: paceSecPerMile,
      actualAverageHeartRate: activity.averageHeartRate,
      actualDurationSeconds: activity.duration ?? null,
      updatedAt: new Date(),
    },
  });

  return { matched: true, workoutId: candidate.id };
}
