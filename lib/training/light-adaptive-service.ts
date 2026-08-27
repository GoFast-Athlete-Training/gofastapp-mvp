/**
 * Long-run durability credit after matched long runs (≥10 mi).
 * 5K pace is no longer auto-nudged here — athlete confirms speed updates separately.
 */

import { prisma } from "@/lib/prisma";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { EASY_LONG_RUN_MAX_FAST_DRIFT_SEC_PER_MILE } from "@/lib/training/apply-activity-to-workout";
import { applyLongRunCapabilityCreditFromWorkout } from "@/lib/training/apply-long-run-capability-credit";

const METERS_PER_MILE = 1609.34;
const LONG_RUN_DISTANCE_RATIO = 0.9;
const MIN_COMPLETED_WORKOUTS = 1;

export type LightAdaptiveEvaluation = {
  eligible: boolean;
  wouldUpdate: boolean;
  reason: string;
  completedWorkouts: number;
  completedMiles: number;
  longRunTargetMet: boolean;
  longRunWorkoutId: string | null;
  suggestedFiveKSecPerMile: number | null;
  currentFiveKSecPerMile: number | null;
};

function roundMi(meters: number): number {
  return Math.round((meters / METERS_PER_MILE) * 10) / 10;
}

type LongRunRow = {
  id: string;
  estimatedDistanceInMeters: number | null;
  actualDistanceMeters: number | null;
  paceDeltaSecPerMile: number | null;
};

function longRunTargetMet(row: LongRunRow): boolean {
  const planned = row.estimatedDistanceInMeters;
  const actual = row.actualDistanceMeters;
  if (planned == null || actual == null || planned <= 0 || actual <= 0) return false;
  if (actual < planned * LONG_RUN_DISTANCE_RATIO) return false;
  const paceDelta = row.paceDeltaSecPerMile;
  if (paceDelta != null) {
    if (paceDelta < -30) return false;
    if (paceDelta > EASY_LONG_RUN_MAX_FAST_DRIFT_SEC_PER_MILE) return false;
  }
  return true;
}

/** Read-only plan snapshot — 5K auto-nudge removed; durability tracked separately. */
export async function evaluateLightAdaptive(params: {
  athleteId: string;
  planId: string;
}): Promise<LightAdaptiveEvaluation> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: params.athleteId },
    select: { fiveKPace: true },
  });

  let currentFiveKSecPerMile: number | null = null;
  try {
    if (athlete?.fiveKPace?.trim()) {
      currentFiveKSecPerMile = parsePaceToSecondsPerMile(athlete.fiveKPace.trim());
    }
  } catch {
    currentFiveKSecPerMile = null;
  }

  const matched = await prisma.workouts.findMany({
    where: {
      athleteId: params.athleteId,
      planId: params.planId,
      matchedActivityId: { not: null },
    },
    select: {
      id: true,
      workoutType: true,
      estimatedDistanceInMeters: true,
      actualDistanceMeters: true,
      paceDeltaSecPerMile: true,
    },
    orderBy: { date: "desc" },
  });

  let completedMeters = 0;
  for (const w of matched) {
    const m = w.actualDistanceMeters;
    if (m != null && Number.isFinite(m) && m > 0) completedMeters += m;
  }

  const completedWorkouts = matched.length;
  const completedMiles = roundMi(completedMeters);
  const longRuns = matched.filter(
    (w) => w.workoutType === "LongRun" || w.workoutType === "Race"
  ) as LongRunRow[];
  const metLongRun = longRuns.find((lr) => longRunTargetMet(lr)) ?? null;

  if (completedWorkouts < MIN_COMPLETED_WORKOUTS) {
    return {
      eligible: false,
      wouldUpdate: false,
      reason: "Complete at least one matched workout on the plan.",
      completedWorkouts,
      completedMiles,
      longRunTargetMet: false,
      longRunWorkoutId: null,
      suggestedFiveKSecPerMile: null,
      currentFiveKSecPerMile,
    };
  }

  if (!metLongRun) {
    return {
      eligible: false,
      wouldUpdate: false,
      reason: "No completed long run with target distance met yet.",
      completedWorkouts,
      completedMiles,
      longRunTargetMet: false,
      longRunWorkoutId: null,
      suggestedFiveKSecPerMile: null,
      currentFiveKSecPerMile,
    };
  }

  return {
    eligible: true,
    wouldUpdate: false,
    reason:
      "Long run target met — durability is tracked on your profile. Confirm 5K updates after interval or race efforts.",
    completedWorkouts,
    completedMiles,
    longRunTargetMet: true,
    longRunWorkoutId: metLongRun.id,
    suggestedFiveKSecPerMile: null,
    currentFiveKSecPerMile,
  };
}

export type LightAdaptiveApplyResult = {
  applied: boolean;
  reason: string;
  previousFiveKSecPerMile: number | null;
  newFiveKSecPerMile: number | null;
};

/** Apply long-run durability credit when a matched long run qualifies. */
export async function applyLightAdaptiveIfEligible(params: {
  athleteId: string;
  planId: string;
  weekNumber?: number | null;
  workoutId?: string | null;
}): Promise<LightAdaptiveApplyResult> {
  if (params.workoutId) {
    try {
      await applyLongRunCapabilityCreditFromWorkout({
        athleteId: params.athleteId,
        workoutId: params.workoutId,
      });
      return {
        applied: true,
        reason: "Long-run durability updated when distance qualifies.",
        previousFiveKSecPerMile: null,
        newFiveKSecPerMile: null,
      };
    } catch (err) {
      console.error("applyLongRunCapabilityCreditFromWorkout:", err);
      return {
        applied: false,
        reason: "Could not update long-run durability.",
        previousFiveKSecPerMile: null,
        newFiveKSecPerMile: null,
      };
    }
  }

  const metLongRun = await prisma.workouts.findFirst({
    where: {
      athleteId: params.athleteId,
      planId: params.planId,
      workoutType: { in: ["LongRun", "Race"] },
      matchedActivityId: { not: null },
    },
    orderBy: { date: "desc" },
    select: { id: true },
  });

  if (!metLongRun) {
    return {
      applied: false,
      reason: "No matched long run on this plan yet.",
      previousFiveKSecPerMile: null,
      newFiveKSecPerMile: null,
    };
  }

  await applyLongRunCapabilityCreditFromWorkout({
    athleteId: params.athleteId,
    workoutId: metLongRun.id,
  });

  return {
    applied: true,
    reason: "Long-run durability refreshed from latest matched long run.",
    previousFiveKSecPerMile: null,
    newFiveKSecPerMile: null,
  };
}
