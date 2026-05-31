/**
 * MVP1 light adaptive path: aggregate mileage + long-run target met → conservative 5K nudge.
 * Easy/tempo/interval runs count for volume only until lap/detail data is reliable.
 */

import { prisma } from "@/lib/prisma";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { syncAthleteFiveKPaceToActivePlan } from "@/lib/training/plan-lifecycle";
import { EASY_LONG_RUN_MAX_FAST_DRIFT_SEC_PER_MILE } from "@/lib/training/apply-activity-to-workout";
import { applyLongRunCapabilityCreditFromWorkout } from "@/lib/training/apply-long-run-capability-credit";

const METERS_PER_MILE = 1609.34;
/** Long run distance considered "target met" when actual >= this fraction of planned. */
const LONG_RUN_DISTANCE_RATIO = 0.9;
/** Max sec/mi improvement from light adaptive (conservative). */
const LIGHT_ADAPTIVE_MAX_NUDGE_SEC = 5;
/** Minimum completed plan workouts before a long-run nudge is considered. */
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

function secondsPerMileToPaceString(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${minutes}:${s.toString().padStart(2, "0")}`;
}

function roundMi(meters: number): number {
  return Math.round((meters / METERS_PER_MILE) * 10) / 10;
}

type LongRunRow = {
  id: string;
  estimatedDistanceInMeters: number | null;
  actualDistanceMeters: number | null;
  paceDeltaSecPerMile: number | null;
  date: Date | null;
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
      date: true,
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

  if (!currentFiveKSecPerMile) {
    return {
      eligible: false,
      wouldUpdate: false,
      reason: "Set a current 5K pace before adaptive updates can apply.",
      completedWorkouts,
      completedMiles,
      longRunTargetMet: Boolean(metLongRun),
      longRunWorkoutId: metLongRun?.id ?? null,
      suggestedFiveKSecPerMile: null,
      currentFiveKSecPerMile: null,
    };
  }

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

  const suggestedFiveKSecPerMile = Math.max(
    Math.floor(currentFiveKSecPerMile * 0.95),
    currentFiveKSecPerMile - LIGHT_ADAPTIVE_MAX_NUDGE_SEC
  );

  if (suggestedFiveKSecPerMile >= currentFiveKSecPerMile) {
    return {
      eligible: true,
      wouldUpdate: false,
      reason: "Long run target met, but 5K pace is already at or faster than the conservative nudge.",
      completedWorkouts,
      completedMiles,
      longRunTargetMet: true,
      longRunWorkoutId: metLongRun.id,
      suggestedFiveKSecPerMile,
      currentFiveKSecPerMile,
    };
  }

  return {
    eligible: true,
    wouldUpdate: true,
    reason: `Long run target met with ${completedMiles} mi completed on plan — conservative 5K pace nudge available.`,
    completedWorkouts,
    completedMiles,
    longRunTargetMet: true,
    longRunWorkoutId: metLongRun.id,
    suggestedFiveKSecPerMile,
    currentFiveKSecPerMile,
  };
}

export type LightAdaptiveApplyResult = {
  applied: boolean;
  reason: string;
  previousFiveKSecPerMile: number | null;
  newFiveKSecPerMile: number | null;
};

/** Apply conservative 5K nudge when evaluateLightAdaptive says wouldUpdate. */
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
    } catch (err) {
      console.error("applyLongRunCapabilityCreditFromWorkout:", err);
    }
  }

  const evaluation = await evaluateLightAdaptive({
    athleteId: params.athleteId,
    planId: params.planId,
  });

  if (!evaluation.wouldUpdate || evaluation.suggestedFiveKSecPerMile == null) {
    return {
      applied: false,
      reason: evaluation.reason,
      previousFiveKSecPerMile: evaluation.currentFiveKSecPerMile,
      newFiveKSecPerMile: null,
    };
  }

  const previousSec = evaluation.currentFiveKSecPerMile!;
  const newSec = evaluation.suggestedFiveKSecPerMile;
  const newPaceStr = secondsPerMileToPaceString(newSec);
  const summaryMessage = `Long run target met — 5K pace nudged to ${newPaceStr}/mi based on plan volume.`;

  await prisma.$transaction(async (tx) => {
    await tx.athlete.update({
      where: { id: params.athleteId },
      data: { fiveKPace: newPaceStr, updatedAt: new Date() },
    });
    await tx.pace_adjustment_log.create({
      data: {
        athleteId: params.athleteId,
        planId: params.planId,
        weekNumber: params.weekNumber ?? undefined,
        workoutId: params.workoutId ?? evaluation.longRunWorkoutId ?? undefined,
        notificationType: "PACE_UPDATE",
        previousPaceSecPerMile: previousSec,
        newPaceSecPerMile: newSec,
        adjustmentSecPerMile: previousSec - newSec,
        qualityWorkoutsCount: 0,
        longRunCompleted: true,
        summaryMessage,
      },
    });
  });

  await syncAthleteFiveKPaceToActivePlan(params.athleteId);

  return {
    applied: true,
    reason: summaryMessage,
    previousFiveKSecPerMile: previousSec,
    newFiveKSecPerMile: newSec,
  };
}
