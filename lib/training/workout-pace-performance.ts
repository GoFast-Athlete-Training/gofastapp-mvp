/**
 * Post-workout performance signals — show estimates; athlete confirms before 5K moves.
 * Durability (long run) still writes automatically via apply-long-run-capability-credit.
 */

import { prisma } from "@/lib/prisma";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { syncAthleteFiveKPaceToActivePlan } from "@/lib/training/plan-lifecycle";
import { rematerializeFuturePlannedWorkoutsForPlan } from "@/lib/training/rematerialize-future-planned-workouts";
import {
  goalThresholdSecPerMileFromGoalMp,
  interpretTempoVsGoalThreshold,
  tempoGoalThresholdInterpretationLabel,
  type TempoGoalThresholdInterpretation,
} from "@/lib/training/goal-threshold-from-mp";
import { computeMatchedWorkoutPaceCredits } from "@/lib/training/apply-activity-to-workout";

const MAX_FIVE_K_SUGGESTION_ADJUST_SEC = 10;
const MIN_FIVE_K_FLOOR_RATIO = 0.9;

export type FiveKPaceSuggestion = {
  eligible: boolean;
  reason: string;
  currentFiveKSecPerMile: number | null;
  impliedFiveKSecPerMile: number | null;
  suggestedFiveKSecPerMile: number | null;
  workoutType: string;
};

export type WorkoutPerformanceSignals = {
  fiveKSuggestion: FiveKPaceSuggestion | null;
  tempoVsGoalThreshold: {
    actualTempoPaceSecPerMile: number | null;
    goalRacePaceSecPerMile: number | null;
    goalThresholdPaceSecPerMile: number | null;
    interpretation: TempoGoalThresholdInterpretation | null;
    interpretationLabel: string | null;
  } | null;
  durability: {
    longRunCapabilityMiles: number | null;
    longRunCapabilityPaceSecPerMile: number | null;
    longRunCapabilityDate: Date | null;
  } | null;
};

function secondsPerMileToPaceString(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${minutes}:${s.toString().padStart(2, "0")}`;
}

function cappedFiveKSuggestion(params: {
  currentSec: number;
  impliedSec: number;
}): number | null {
  const { currentSec, impliedSec } = params;
  if (impliedSec >= currentSec) return null;
  const adjustSec = Math.min(MAX_FIVE_K_SUGGESTION_ADJUST_SEC, currentSec - impliedSec);
  const newSec = Math.max(currentSec - adjustSec, Math.floor(currentSec * MIN_FIVE_K_FLOOR_RATIO));
  if (newSec >= currentSec) return null;
  return newSec;
}

/** Suggest 5K update from Intervals or Race match — does not write athlete profile. */
export function computeFiveKPaceSuggestion(params: {
  workoutType: string;
  paceSecPerMile: number | null;
  paceDeltaSecPerMile: number | null;
  currentFiveKSecPerMile: number | null;
  intervalsCatalogueOffsetSecPerMile?: number | null;
}): FiveKPaceSuggestion {
  const base: FiveKPaceSuggestion = {
    eligible: false,
    reason: "5K updates require a matched interval or race effort on or faster than target.",
    currentFiveKSecPerMile: params.currentFiveKSecPerMile,
    impliedFiveKSecPerMile: null,
    suggestedFiveKSecPerMile: null,
    workoutType: params.workoutType,
  };

  if (params.currentFiveKSecPerMile == null) {
    return { ...base, reason: "Set a current 5K pace before speed updates can apply." };
  }

  const credits = computeMatchedWorkoutPaceCredits({
    workoutType: params.workoutType,
    paceSecPerMile: params.paceSecPerMile,
    paceDeltaSecPerMile: params.paceDeltaSecPerMile,
    intervalsCatalogueOffsetSecPerMile: params.intervalsCatalogueOffsetSecPerMile,
  });

  let implied = credits.creditedFiveKPaceSecPerMile;

  if (
    params.workoutType === "Race" &&
    params.paceSecPerMile != null &&
    params.paceDeltaSecPerMile != null &&
    params.paceDeltaSecPerMile >= 0
  ) {
    implied = Math.round(params.paceSecPerMile);
  }

  if (implied == null) {
    return base;
  }

  const suggested = cappedFiveKSuggestion({
    currentSec: params.currentFiveKSecPerMile,
    impliedSec: implied,
  });

  if (suggested == null) {
    return {
      ...base,
      impliedFiveKSecPerMile: implied,
      reason: "Effort does not imply a faster 5K than your current anchor.",
    };
  }

  return {
    eligible: true,
    reason: "Based on this session, you may want to lower your 5K anchor.",
    currentFiveKSecPerMile: params.currentFiveKSecPerMile,
    impliedFiveKSecPerMile: implied,
    suggestedFiveKSecPerMile: suggested,
    workoutType: params.workoutType,
  };
}

export async function loadWorkoutPerformanceSignals(params: {
  athleteId: string;
  workout: {
    workoutType: string;
    paceSecPerMile: number | null;
    paceDeltaSecPerMile: number | null;
    creditedFiveKPaceSecPerMile: number | null;
    creditedThresholdPaceSecPerMile: number | null;
    goalRacePaceSecPerMile?: number | null;
    intervalsCatalogueOffsetSecPerMile?: number | null;
  };
}): Promise<WorkoutPerformanceSignals> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: params.athleteId },
    select: {
      fiveKPace: true,
      longRunCapabilityMiles: true,
      longRunCapabilityPaceSecPerMile: true,
      longRunCapabilityDate: true,
    },
  });

  let currentFiveKSecPerMile: number | null = null;
  try {
    if (athlete?.fiveKPace?.trim()) {
      currentFiveKSecPerMile = parsePaceToSecondsPerMile(athlete.fiveKPace.trim());
    }
  } catch {
    currentFiveKSecPerMile = null;
  }

  const fiveKSuggestion =
    params.workout.workoutType === "Intervals" || params.workout.workoutType === "Race"
      ? computeFiveKPaceSuggestion({
          workoutType: params.workout.workoutType,
          paceSecPerMile: params.workout.paceSecPerMile,
          paceDeltaSecPerMile: params.workout.paceDeltaSecPerMile,
          currentFiveKSecPerMile,
          intervalsCatalogueOffsetSecPerMile:
            params.workout.intervalsCatalogueOffsetSecPerMile ?? null,
        })
      : null;

  let tempoVsGoalThreshold: WorkoutPerformanceSignals["tempoVsGoalThreshold"] = null;
  if (params.workout.workoutType === "Tempo") {
    const goalRacePaceSecPerMile = params.workout.goalRacePaceSecPerMile ?? null;
    const goalThresholdPaceSecPerMile =
      goalThresholdSecPerMileFromGoalMp(goalRacePaceSecPerMile);
    const actualTempoPaceSecPerMile =
      params.workout.paceSecPerMile ?? params.workout.creditedThresholdPaceSecPerMile;
    const interpretation = interpretTempoVsGoalThreshold(
      actualTempoPaceSecPerMile,
      goalThresholdPaceSecPerMile
    );
    tempoVsGoalThreshold = {
      actualTempoPaceSecPerMile,
      goalRacePaceSecPerMile,
      goalThresholdPaceSecPerMile,
      interpretation,
      interpretationLabel: tempoGoalThresholdInterpretationLabel(interpretation),
    };
  }

  const durability =
    athlete?.longRunCapabilityMiles != null ||
    athlete?.longRunCapabilityPaceSecPerMile != null
      ? {
          longRunCapabilityMiles: athlete?.longRunCapabilityMiles ?? null,
          longRunCapabilityPaceSecPerMile:
            athlete?.longRunCapabilityPaceSecPerMile ?? null,
          longRunCapabilityDate: athlete?.longRunCapabilityDate ?? null,
        }
      : null;

  return { fiveKSuggestion, tempoVsGoalThreshold, durability };
}

export type ConfirmFiveKPaceResult = {
  applied: boolean;
  reason: string;
  previousFiveKSecPerMile: number | null;
  newFiveKSecPerMile: number | null;
};

/** Athlete-confirmed 5K update from a matched workout suggestion. */
export async function confirmAthleteFiveKPaceFromWorkout(params: {
  athleteId: string;
  workoutId: string;
  suggestedFiveKSecPerMile: number;
  planId?: string | null;
  weekNumber?: number | null;
}): Promise<ConfirmFiveKPaceResult> {
  const workout = await prisma.workouts.findFirst({
    where: { id: params.workoutId, athleteId: params.athleteId },
    select: {
      workoutType: true,
      planId: true,
      weekNumber: true,
      creditedFiveKPaceSecPerMile: true,
    },
  });

  if (!workout) {
    return {
      applied: false,
      reason: "Workout not found.",
      previousFiveKSecPerMile: null,
      newFiveKSecPerMile: null,
    };
  }

  if (workout.workoutType !== "Intervals" && workout.workoutType !== "Race") {
    return {
      applied: false,
      reason: "5K updates are only offered after interval or race efforts.",
      previousFiveKSecPerMile: null,
      newFiveKSecPerMile: null,
    };
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: params.athleteId },
    select: { fiveKPace: true },
  });
  if (!athlete?.fiveKPace?.trim()) {
    return {
      applied: false,
      reason: "Set a current 5K pace first.",
      previousFiveKSecPerMile: null,
      newFiveKSecPerMile: null,
    };
  }

  const previousSec = parsePaceToSecondsPerMile(athlete.fiveKPace.trim());
  const newSec = Math.round(params.suggestedFiveKSecPerMile);

  if (newSec >= previousSec) {
    return {
      applied: false,
      reason: "Suggested 5K is not faster than your current anchor.",
      previousFiveKSecPerMile: previousSec,
      newFiveKSecPerMile: null,
    };
  }

  const newPaceStr = secondsPerMileToPaceString(newSec);
  const planId = params.planId ?? workout.planId ?? null;
  const weekNumber = params.weekNumber ?? workout.weekNumber ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.athlete.update({
      where: { id: params.athleteId },
      data: { fiveKPace: newPaceStr, updatedAt: new Date() },
    });
    await tx.pace_adjustment_log.create({
      data: {
        athleteId: params.athleteId,
        planId: planId ?? undefined,
        weekNumber: weekNumber ?? undefined,
        workoutId: params.workoutId,
        notificationType: "PACE_UPDATE",
        previousPaceSecPerMile: previousSec,
        newPaceSecPerMile: newSec,
        adjustmentSecPerMile: previousSec - newSec,
        summaryMessage: `You confirmed updating 5K pace to ${newPaceStr}/mi based on this workout.`,
      },
    });
  });

  await syncAthleteFiveKPaceToActivePlan(params.athleteId);

  if (planId) {
    try {
      await rematerializeFuturePlannedWorkoutsForPlan({
        athleteId: params.athleteId,
        planId,
      });
    } catch (err) {
      console.error("rematerialize after confirm 5K:", err);
    }
  }

  return {
    applied: true,
    reason: `5K pace updated to ${newPaceStr}/mi.`,
    previousFiveKSecPerMile: previousSec,
    newFiveKSecPerMile: newSec,
  };
}
