/**
 * Persist best recent long-run capability on the athlete profile for GoFast race projection.
 * Updated when a matched LongRun workout qualifies (≥10 mi).
 */

import { prisma } from "@/lib/prisma";

const METERS_PER_MILE = 1609.34;
export const MIN_LONG_RUN_CAPABILITY_MILES = 10;

export async function applyLongRunCapabilityCredit(params: {
  athleteId: string;
  distanceMiles: number;
  paceSecPerMile: number;
  completedAt?: Date | null;
}): Promise<void> {
  const { athleteId, distanceMiles, paceSecPerMile, completedAt } = params;

  if (!Number.isFinite(distanceMiles) || distanceMiles < MIN_LONG_RUN_CAPABILITY_MILES) {
    return;
  }
  if (!Number.isFinite(paceSecPerMile) || paceSecPerMile <= 0) {
    return;
  }

  await prisma.athlete.update({
    where: { id: athleteId },
    data: {
      longRunCapabilityMiles: Math.round(distanceMiles * 10) / 10,
      longRunCapabilityPaceSecPerMile: Math.round(paceSecPerMile),
      longRunCapabilityDate: completedAt ?? new Date(),
      updatedAt: new Date(),
    },
  });
}

/** Apply capability credit from a matched plan workout row. */
export async function applyLongRunCapabilityCreditFromWorkout(params: {
  athleteId: string;
  workoutId: string;
}): Promise<void> {
  const workout = await prisma.workouts.findFirst({
    where: {
      id: params.workoutId,
      athleteId: params.athleteId,
      workoutType: { in: ["LongRun", "Race"] },
      matchedActivityId: { not: null },
    },
    select: {
      actualDistanceMeters: true,
      actualAvgPaceSecPerMile: true,
      date: true,
    },
  });

  if (!workout?.actualDistanceMeters || !workout.actualAvgPaceSecPerMile) {
    return;
  }

  const distanceMiles = workout.actualDistanceMeters / METERS_PER_MILE;
  await applyLongRunCapabilityCredit({
    athleteId: params.athleteId,
    distanceMiles,
    paceSecPerMile: workout.actualAvgPaceSecPerMile,
    completedAt: workout.date,
  });
}
