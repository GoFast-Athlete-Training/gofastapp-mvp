/**
 * Explicit Splits state for UI and observability.
 */

import {
  computeWorkoutPerformanceAnalysis,
  type PerformanceAnalysisWorkoutInput,
  type WorkoutPerformanceAnalysis,
} from "./workout-performance-analysis";
import { workoutHasLapPaceDeltas } from "./workout-pace-analyzer";

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
  failureReason: string | null;
};

export type PaceForPaceStatusInput = PerformanceAnalysisWorkoutInput & {
  matchedActivityId?: string | null;
};

function hasSplitsComparison(
  analysis: WorkoutPerformanceAnalysis,
  workout: PaceForPaceStatusInput
): boolean {
  return workoutHasLapPaceDeltas(workout.segments);
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

  if (hasSplitsComparison(perf, workout)) {
    const deltaCount = workout.segments.reduce(
      (n, s) =>
        n +
        (s.segment_laps?.filter(
          (l) => l.paceDeltaSecPerMile != null && Number.isFinite(l.paceDeltaSecPerMile)
        ).length ?? 0),
      0
    );
    return {
      status: "PACE_FOR_PACE_AVAILABLE",
      message: deltaCount > 0 ? `${deltaCount} split${deltaCount === 1 ? "" : "s"} analyzed` : null,
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
    "Splits aren't available.";

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
      return "Needs analysis";
    case "PACE_FOR_PACE_AVAILABLE":
      return "Splits available";
    case "PACE_FOR_PACE_FAILED":
      return "Analysis failed";
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
