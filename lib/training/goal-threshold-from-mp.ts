/**
 * Goal threshold pace — derived from goal marathon pace (MP), not Athlete.thresholdPace.
 * Used to classify whether a prescribed Tempo session aims at race-threshold stimulus.
 */

import type { WorkoutStep } from "@/lib/training/prescription";
import {
  normalizePaceTargetEncodingVersion,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import { isWorkSegmentTitle } from "@/lib/training/workout-performance-analysis";

/** MP minus this many sec/mi → goal threshold (e.g. 6:52 MP → ~6:27 T). */
export const GOAL_THRESHOLD_GAP_SEC_PER_MILE = 25;

/** Prescribed Tempo slower than goal T by more than this → below target stimulus. */
export const BELOW_TARGET_STIMULUS_GAP_SEC = 15;

/** Prescribed Tempo within this many sec/mi of goal T → approaching. */
export const APPROACHING_GOAL_THRESHOLD_BAND_SEC = 8;

/** Prescribed Tempo faster than goal T by more than this → faster than threshold target. */
export const FASTER_THAN_THRESHOLD_BAND_SEC = 5;

export type TempoGoalThresholdInterpretation =
  | "BELOW_TARGET_STIMULUS"
  | "APPROACHING_GOAL_THRESHOLD"
  | "ALIGNED_WITH_GOAL_THRESHOLD"
  | "FASTER_THAN_THRESHOLD_TARGET";

export type TempoPrescriptionGoalBenchmark = {
  prescriptionAnchor: "fiveK";
  goalBenchmark: "goalThreshold";
  goalRacePaceSecPerMile: number | null;
  goalThresholdPaceSecPerMile: number | null;
  prescribedTempoPaceSecPerMile: number | null;
  interpretation: TempoGoalThresholdInterpretation | null;
};

export function goalThresholdSecPerMileFromGoalMp(
  mpSecPerMile: number | null | undefined
): number | null {
  if (mpSecPerMile == null || !Number.isFinite(mpSecPerMile) || mpSecPerMile <= 0) {
    return null;
  }
  return Math.max(180, Math.round(mpSecPerMile - GOAL_THRESHOLD_GAP_SEC_PER_MILE));
}

export function interpretTempoVsGoalThreshold(
  prescribedSec: number | null | undefined,
  goalThresholdSec: number | null | undefined
): TempoGoalThresholdInterpretation | null {
  if (
    prescribedSec == null ||
    goalThresholdSec == null ||
    !Number.isFinite(prescribedSec) ||
    !Number.isFinite(goalThresholdSec)
  ) {
    return null;
  }

  const delta = prescribedSec - goalThresholdSec;

  if (delta > BELOW_TARGET_STIMULUS_GAP_SEC) {
    return "BELOW_TARGET_STIMULUS";
  }
  if (delta > APPROACHING_GOAL_THRESHOLD_BAND_SEC) {
    return "APPROACHING_GOAL_THRESHOLD";
  }
  if (delta >= -FASTER_THAN_THRESHOLD_BAND_SEC) {
    return "ALIGNED_WITH_GOAL_THRESHOLD";
  }
  return "FASTER_THAN_THRESHOLD_TARGET";
}

function paceTargetSecPerMileFromStepTargets(targets: unknown): number | null {
  if (!Array.isArray(targets) || targets.length === 0) return null;
  const t = targets[0] as { type?: string; valueLow?: number; value?: number };
  if (!t?.type || String(t.type).toUpperCase() !== "PACE") return null;
  const low = t.valueLow ?? t.value;
  if (low == null || typeof low !== "number" || low <= 0) return null;
  const enc = normalizePaceTargetEncodingVersion(2);
  return Math.round(storedPaceSecondsKmToSecondsPerMile(low, enc));
}

/** Mean prescribed work-segment pace from materialized Tempo steps. */
export function prescribedTempoPaceSecPerMileFromSteps(
  steps: WorkoutStep[]
): number | null {
  const workPaces: number[] = [];
  for (const step of steps) {
    if (!isWorkSegmentTitle(step.title)) continue;
    const pace = paceTargetSecPerMileFromStepTargets(step.targets);
    if (pace != null && pace > 0) workPaces.push(pace);
  }
  if (workPaces.length === 0) return null;
  return Math.round(workPaces.reduce((a, b) => a + b, 0) / workPaces.length);
}

export function buildTempoPrescriptionGoalBenchmark(params: {
  steps: WorkoutStep[];
  goalRacePaceSecPerMile: number | null;
}): TempoPrescriptionGoalBenchmark | null {
  const prescribedTempoPaceSecPerMile = prescribedTempoPaceSecPerMileFromSteps(params.steps);
  const goalThresholdPaceSecPerMile = goalThresholdSecPerMileFromGoalMp(
    params.goalRacePaceSecPerMile
  );
  const interpretation = interpretTempoVsGoalThreshold(
    prescribedTempoPaceSecPerMile,
    goalThresholdPaceSecPerMile
  );

  if (
    prescribedTempoPaceSecPerMile == null &&
    goalThresholdPaceSecPerMile == null &&
    params.goalRacePaceSecPerMile == null
  ) {
    return null;
  }

  return {
    prescriptionAnchor: "fiveK",
    goalBenchmark: "goalThreshold",
    goalRacePaceSecPerMile: params.goalRacePaceSecPerMile,
    goalThresholdPaceSecPerMile,
    prescribedTempoPaceSecPerMile,
    interpretation,
  };
}

export function tempoGoalThresholdInterpretationLabel(
  interpretation: TempoGoalThresholdInterpretation | null | undefined
): string | null {
  switch (interpretation) {
    case "BELOW_TARGET_STIMULUS":
      return "Prescribed tempo is slower than goal threshold — limited threshold stimulus vs race goal.";
    case "APPROACHING_GOAL_THRESHOLD":
      return "Prescribed tempo is close to goal threshold — building toward race T.";
    case "ALIGNED_WITH_GOAL_THRESHOLD":
      return "Prescribed tempo aligns with goal threshold from your race MP.";
    case "FASTER_THAN_THRESHOLD_TARGET":
      return "Prescribed tempo is faster than goal threshold — aggressive vs race T.";
    default:
      return null;
  }
}
