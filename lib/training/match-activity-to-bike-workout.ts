/**
 * Promote raw athlete_activity → matched bike_workout (Garmin cycling summary).
 * Primary match: garminWorkoutId from webhook payload ↔ bike_workout.garminWorkoutId
 * Fallback: same athlete, same UTC calendar day, unmatched bike workout
 */

import type { bike_workout_step } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractGarminWorkoutIdFromSummary } from "./extract-garmin-workout-id";
import { isCyclingActivityType } from "./activity-type-sets";

function utcDayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function powerMidFromStep(step: {
  powerWattsLow: number | null;
  powerWattsHigh: number | null;
}): number | null {
  const low = step.powerWattsLow;
  const high = step.powerWattsHigh ?? low;
  if (low == null && high == null) return null;
  if (low != null && high != null) return Math.round((low + high) / 2);
  if (low != null) return Math.round(low);
  if (high != null) return Math.round(high);
  return null;
}

function pickMainPowerTargetWatts(steps: bike_workout_step[]): number | null {
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  for (const step of sorted) {
    const title = (step.title || "").toLowerCase();
    if (title.includes("warmup") || title.includes("warm-up")) continue;
    if (title.includes("cooldown") || title.includes("cool-down")) continue;
    const mid = powerMidFromStep(step);
    if (mid != null) return mid;
  }
  for (const step of sorted) {
    const mid = powerMidFromStep(step);
    if (mid != null) return mid;
  }
  return null;
}

const bikeMatchInclude = {
  steps: { orderBy: { stepOrder: "asc" as const } },
};

/**
 * Match a cycling activity to at most one bike_workout; promote summary fields onto bike_workout.
 */
export async function tryMatchActivityToBikeWorkout(
  athleteActivityId: string
): Promise<{ matched: boolean; bikeWorkoutId?: string }> {
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: athleteActivityId },
  });

  if (!activity) {
    return { matched: false };
  }

  const setIngestion = async (status: string) => {
    await prisma.athlete_activities.update({
      where: { id: athleteActivityId },
      data: { ingestionStatus: status },
    });
  };

  if (!activity.startTime) {
    await setIngestion("UNMATCHED");
    return { matched: false };
  }

  if (!isCyclingActivityType(activity.activityType)) {
    await setIngestion("INELIGIBLE");
    return { matched: false };
  }

  const summaryBlob = activity.summaryData as Record<string, unknown> | null;
  const garminWorkoutId = extractGarminWorkoutIdFromSummary(summaryBlob);

  let candidate = null;

  if (garminWorkoutId != null) {
    candidate = await prisma.bike_workout.findFirst({
      where: {
        athleteId: activity.athleteId,
        garminWorkoutId,
        matchedActivityId: null,
      },
      include: bikeMatchInclude,
    });
  }

  if (!candidate) {
    const { start, end } = utcDayBounds(activity.startTime);
    candidate = await prisma.bike_workout.findFirst({
      where: {
        athleteId: activity.athleteId,
        date: { gte: start, lte: end },
        matchedActivityId: null,
      },
      orderBy: { date: "asc" },
      include: bikeMatchInclude,
    });
  }

  if (!candidate) {
    await setIngestion("UNMATCHED");
    return { matched: false };
  }

  const distanceMeters =
    activity.distance != null && activity.distance > 0 ? activity.distance : null;

  const actualAvgPower =
    activity.averagePower != null && activity.averagePower > 0
      ? activity.averagePower
      : null;

  const targetPowerWatts = pickMainPowerTargetWatts(candidate.steps);

  let powerDeltaWatts: number | null = null;
  if (targetPowerWatts != null && actualAvgPower != null) {
    powerDeltaWatts = actualAvgPower - targetPowerWatts;
  }

  await prisma.bike_workout.update({
    where: { id: candidate.id },
    data: {
      matchedActivityId: activity.id,
      actualDurationSeconds: activity.duration ?? null,
      actualDistanceMeters: distanceMeters,
      actualAvgPowerWatts: actualAvgPower,
      actualAverageHeartRate: activity.averageHeartRate ?? null,
      actualMaxHeartRate: activity.maxHeartRate ?? null,
      actualElevationGain: activity.elevationGain ?? null,
      actualCalories: activity.calories ?? null,
      powerDeltaWatts,
      updatedAt: new Date(),
    },
  });

  await setIngestion("MATCHED");

  return { matched: true, bikeWorkoutId: candidate.id };
}
