/**
 * Explicit Pace for Pace state for UI and observability.
 * Canon: every workout is prescribed — never return NO_STRUCTURED_PACE_TARGETS for eligibility.
 */

import {
  buildWorkSegmentDeltas,
  computeWorkoutPerformanceAnalysis,
  type PerformanceAnalysisWorkoutInput,
  type WorkoutPerformanceAnalysis,
} from "./workout-performance-analysis";
import { workoutHasPacedWorkSegments } from "./workout-paced-segments";

export type PaceForPaceStatus =
  | "UNMATCHED"
  | "MATCHED_ANALYSIS_NOT_GENERATED"
  | "PACE_FOR_PACE_AVAILABLE"
  | "PACE_FOR_PACE_FAILED"
  /** @deprecated Kept for API compat — no longer emitted for eligibility gating */
  | "NO_STRUCTURED_PACE_TARGETS";

export type PaceForPaceStatusResult = {
  status: PaceForPaceStatus;
  message: string | null;
  /** When status is PACE_FOR_PACE_FAILED or MATCHED_ANALYSIS_NOT_GENERATED */
  failureReason: string | null;
};

export type PaceForPaceStatusInput = PerformanceAnalysisWorkoutInput & {
  matchedActivityId?: string | null;
};

function hasPaceForPaceComparison(
  analysis: WorkoutPerformanceAnalysis,
  workout: PaceForPaceStatusInput
): boolean {
  if ((analysis.scorecard.workSegmentDeltas?.length ?? 0) > 0) return true;
  if (analysis.scorecard.workEffort?.summary) return true;
  if (
    workout.targetPaceSecPerMile != null &&
    workout.actualAvgPaceSecPerMile != null &&
    !analysis.requiresSegmentLevelPaceForPace
  ) {
    return true;
  }
  if (analysis.phaseAwareLaps.some((lap) => lap.phase === "work" && lap.paceSecPerMile != null)) {
    return true;
  }
  return (
    analysis.canJudgeTargetPace &&
    (analysis.workSegmentActual?.segments.some((s) => s.actualPaceSecPerMile != null) ?? false)
  );
}

export function derivePaceForPaceStatus(
  workout: PaceForPaceStatusInput,
  analysis?: WorkoutPerformanceAnalysis | null
): PaceForPaceStatusResult {
  const perf =
    analysis ??
    computeWorkoutPerformanceAnalysis({
      workoutType: workout.workoutType,
      targetPaceSecPerMile: workout.targetPaceSecPerMile,
      targetPaceSecPerMileHigh: workout.targetPaceSecPerMileHigh,
      paceDeltaSecPerMile: workout.paceDeltaSecPerMile,
      actualAvgPaceSecPerMile: workout.actualAvgPaceSecPerMile,
      actualDistanceMeters: workout.actualDistanceMeters,
      actualDurationSeconds: workout.actualDurationSeconds,
      estimatedDistanceInMeters: workout.estimatedDistanceInMeters,
      completedActivityDetailJson: workout.completedActivityDetailJson,
      matchedActivityId: workout.matchedActivityId,
      matched_activity: workout.matched_activity,
      segmentExecutionStatus: workout.segmentExecutionStatus,
      segmentExecutionLapCount: workout.segmentExecutionLapCount,
      segmentExecutionSegmentCount: workout.segmentExecutionSegmentCount,
      segments: workout.segments,
    });

  if (!workout.matchedActivityId) {
    return {
      status: "UNMATCHED",
      message: "No activity linked to this workout yet.",
      failureReason: null,
    };
  }

  if (hasPaceForPaceComparison(perf, workout)) {
    return {
      status: "PACE_FOR_PACE_AVAILABLE",
      message: perf.executionHeadline ?? perf.scorecard.workEffort?.summary,
      failureReason: null,
    };
  }

  if (perf.paceForPaceError) {
    return {
      status: "PACE_FOR_PACE_FAILED",
      message: perf.paceForPaceError,
      failureReason: perf.paceForPaceError,
    };
  }

  if (workout.segmentExecutionStatus === "ALIGNMENT_FAILED") {
    const lapCount = workout.segmentExecutionLapCount;
    const segmentCount = workout.segmentExecutionSegmentCount;
    const reason =
      lapCount != null && segmentCount != null
        ? `Garmin laps (${lapCount}) did not match planned steps (${segmentCount}).`
        : "Activity laps did not match the planned workout structure.";
    return {
      status: "PACE_FOR_PACE_FAILED",
      message: reason,
      failureReason: reason,
    };
  }

  const reason =
    perf.paceForPaceError ??
    perf.completionOnlyMessage ??
    "Pace for Pace analysis has not been generated for this activity yet.";

  return {
    status: "MATCHED_ANALYSIS_NOT_GENERATED",
    message: reason,
    failureReason: reason,
  };
}

export function paceForPaceStatusLabel(status: PaceForPaceStatus): string {
  switch (status) {
    case "UNMATCHED":
      return "Unmatched";
    case "MATCHED_ANALYSIS_NOT_GENERATED":
      return "Analysis not generated";
    case "PACE_FOR_PACE_AVAILABLE":
      return "Pace for Pace available";
    case "PACE_FOR_PACE_FAILED":
      return "Pace for Pace failed";
    case "NO_STRUCTURED_PACE_TARGETS":
      return "No structured pace targets";
    default:
      return status;
  }
}

export function shouldShowPaceForPaceOffRamp(status: PaceForPaceStatus): boolean {
  return (
    status === "UNMATCHED" ||
    status === "MATCHED_ANALYSIS_NOT_GENERATED" ||
    status === "PACE_FOR_PACE_FAILED"
  );
}

/** Re-export for tests */
export { workoutHasPacedWorkSegments, buildWorkSegmentDeltas };
