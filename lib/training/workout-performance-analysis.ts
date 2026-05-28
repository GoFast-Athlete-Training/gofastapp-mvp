/**
 * Unified performance analysis: detail readiness + work-segment actuals (reps only).
 * Used by workout GET, AnalysisDeepPanel, and coach feedback.
 */

import {
  normalizePaceTargetEncodingVersion,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import { isRecoveryTitle } from "@/lib/training/segment-summary";

export type AnalysisMode = "detail" | "summary_pending_detail" | "summary_only";

export type WorkSegmentActualRow = {
  segmentId: string;
  title: string;
  stepOrder: number;
  targetPaceSecPerMile: number | null;
  targetPaceSecPerMileHigh: number | null;
  actualPaceSecPerMile: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMiles: number | null;
  lapCount: number;
};

export type WorkSegmentActual = {
  actualPaceSecPerMile: number | null;
  /** target − actual; positive = faster than target */
  paceDeltaSecPerMile: number | null;
  targetPaceSecPerMile: number | null;
  targetPaceSecPerMileHigh: number | null;
  workSegmentCount: number;
  segments: WorkSegmentActualRow[];
};

export type WorkoutPerformanceAnalysis = {
  hasActivityDetail: boolean;
  hasSegmentActuals: boolean;
  hasWorkSegmentActuals: boolean;
  analysisMode: AnalysisMode;
  requiresDetailForTargetAnalysis: boolean;
  canJudgeTargetPace: boolean;
  workSegmentActual: WorkSegmentActual | null;
};

type SegmentTarget = { type?: string; valueLow?: number; valueHigh?: number; value?: number };

export type PerformanceAnalysisSegmentInput = {
  id: string;
  title: string;
  stepOrder: number;
  targets: unknown;
  paceTargetEncodingVersion: number;
  actualPaceSecPerMile: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMiles: number | null;
  segment_laps?: { id: string }[];
};

export type PerformanceAnalysisWorkoutInput = {
  workoutType: string;
  targetPaceSecPerMile: number | null;
  targetPaceSecPerMileHigh: number | null;
  paceDeltaSecPerMile: number | null;
  actualAvgPaceSecPerMile: number | null;
  completedActivityDetailJson?: unknown;
  matchedActivityId?: string | null;
  matched_activity?: {
    detailData?: unknown;
    hydratedAt?: Date | null;
  } | null;
  segments: PerformanceAnalysisSegmentInput[];
};

const STRUCTURED_TARGET_TYPES = new Set(["Intervals", "Tempo"]);

function isBookendTitle(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("warm") || t.includes("cool");
}

export function isWorkSegmentTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  if (isRecoveryTitle(title)) return false;
  if (isBookendTitle(title)) return false;
  return true;
}

export function requiresDetailForTargetAnalysis(workoutType: string): boolean {
  return STRUCTURED_TARGET_TYPES.has(workoutType);
}

function paceTargetSecPerMileFromSegment(
  targets: unknown,
  paceTargetEncodingVersion: number
): number | null {
  if (!Array.isArray(targets) || targets.length === 0) return null;
  const t = targets[0] as SegmentTarget;
  if (!t?.type || String(t.type).toUpperCase() !== "PACE") return null;
  const low = t.valueLow ?? t.value;
  if (low == null || typeof low !== "number" || low <= 0) return null;
  const enc = normalizePaceTargetEncodingVersion(paceTargetEncodingVersion);
  return Math.round(storedPaceSecondsKmToSecondsPerMile(low, enc));
}

function paceTargetHighSecPerMileFromSegment(
  targets: unknown,
  paceTargetEncodingVersion: number
): number | null {
  if (!Array.isArray(targets) || targets.length === 0) return null;
  const t = targets[0] as SegmentTarget;
  if (!t?.type || String(t.type).toUpperCase() !== "PACE") return null;
  const highRaw = t.valueHigh;
  if (highRaw == null || typeof highRaw !== "number" || highRaw <= 0) return null;
  const enc = normalizePaceTargetEncodingVersion(paceTargetEncodingVersion);
  return Math.round(storedPaceSecondsKmToSecondsPerMile(highRaw, enc));
}

function pickWorkTargetFromSegments(
  segments: PerformanceAnalysisSegmentInput[]
): { targetSecPerMile: number | null; targetSecPerMileHigh: number | null } {
  const sorted = [...segments]
    .filter((s) => isWorkSegmentTitle(s.title))
    .sort((a, b) => a.stepOrder - b.stepOrder);

  for (const seg of sorted) {
    const p = paceTargetSecPerMileFromSegment(seg.targets, seg.paceTargetEncodingVersion);
    if (p != null) {
      return {
        targetSecPerMile: p,
        targetSecPerMileHigh: paceTargetHighSecPerMileFromSegment(
          seg.targets,
          seg.paceTargetEncodingVersion
        ),
      };
    }
  }
  return { targetSecPerMile: null, targetSecPerMileHigh: null };
}

export function computeWorkSegmentActual(
  segments: PerformanceAnalysisSegmentInput[],
  workoutTargetLow: number | null,
  workoutTargetHigh: number | null
): WorkSegmentActual | null {
  const workSegments = [...segments]
    .filter((s) => isWorkSegmentTitle(s.title))
    .sort((a, b) => a.stepOrder - b.stepOrder);

  if (workSegments.length === 0) return null;

  const rows: WorkSegmentActualRow[] = workSegments.map((seg) => ({
    segmentId: seg.id,
    title: seg.title,
    stepOrder: seg.stepOrder,
    targetPaceSecPerMile: paceTargetSecPerMileFromSegment(
      seg.targets,
      seg.paceTargetEncodingVersion
    ),
    targetPaceSecPerMileHigh: paceTargetHighSecPerMileFromSegment(
      seg.targets,
      seg.paceTargetEncodingVersion
    ),
    actualPaceSecPerMile: seg.actualPaceSecPerMile,
    actualDurationSeconds: seg.actualDurationSeconds,
    actualDistanceMiles: seg.actualDistanceMiles,
    lapCount: seg.segment_laps?.length ?? 0,
  }));

  let paceWeighted = 0;
  let paceWeight = 0;
  for (const row of rows) {
    if (row.actualPaceSecPerMile != null && (row.actualDurationSeconds ?? 0) > 0) {
      paceWeighted += row.actualPaceSecPerMile * (row.actualDurationSeconds as number);
      paceWeight += row.actualDurationSeconds as number;
    }
  }

  const actualPaceSecPerMile =
    paceWeight > 0 ? Math.round(paceWeighted / paceWeight) : null;

  const segmentTargets = pickWorkTargetFromSegments(segments);
  const targetPaceSecPerMile = segmentTargets.targetSecPerMile ?? workoutTargetLow;
  const targetPaceSecPerMileHigh =
    segmentTargets.targetSecPerMileHigh ?? workoutTargetHigh;

  let paceDeltaSecPerMile: number | null = null;
  if (targetPaceSecPerMile != null && actualPaceSecPerMile != null) {
    paceDeltaSecPerMile = targetPaceSecPerMile - actualPaceSecPerMile;
  }

  return {
    actualPaceSecPerMile,
    paceDeltaSecPerMile,
    targetPaceSecPerMile,
    targetPaceSecPerMileHigh,
    workSegmentCount: rows.length,
    segments: rows,
  };
}

function segmentHasActuals(seg: PerformanceAnalysisSegmentInput): boolean {
  return (
    seg.actualPaceSecPerMile != null ||
    seg.actualDurationSeconds != null ||
    seg.actualDistanceMiles != null ||
    (seg.segment_laps?.length ?? 0) > 0
  );
}

export function computeWorkoutPerformanceAnalysis(
  workout: PerformanceAnalysisWorkoutInput
): WorkoutPerformanceAnalysis {
  const hasActivityDetail =
    workout.completedActivityDetailJson != null ||
    workout.matched_activity?.detailData != null ||
    workout.matched_activity?.hydratedAt != null;

  const workSegments = workout.segments.filter((s) => isWorkSegmentTitle(s.title));
  const hasSegmentActuals = workout.segments.some(segmentHasActuals);
  const hasWorkSegmentActuals = workSegments.some(
    (s) => s.actualPaceSecPerMile != null || (s.segment_laps?.length ?? 0) > 0
  );

  const requiresDetail = requiresDetailForTargetAnalysis(workout.workoutType);

  let analysisMode: AnalysisMode;
  if (requiresDetail) {
    if (hasActivityDetail && hasWorkSegmentActuals) {
      analysisMode = "detail";
    } else if (hasActivityDetail && hasSegmentActuals) {
      analysisMode = "detail";
    } else {
      analysisMode = "summary_pending_detail";
    }
  } else if (hasActivityDetail || hasSegmentActuals) {
    analysisMode = "detail";
  } else {
    analysisMode = "summary_only";
  }

  const workSegmentActual =
    hasWorkSegmentActuals || (analysisMode === "detail" && hasSegmentActuals)
      ? computeWorkSegmentActual(
          workout.segments,
          workout.targetPaceSecPerMile,
          workout.targetPaceSecPerMileHigh
        )
      : null;

  const canJudgeTargetPace = requiresDetail
    ? analysisMode === "detail" && workSegmentActual?.actualPaceSecPerMile != null
    : workout.actualAvgPaceSecPerMile != null ||
      workSegmentActual?.actualPaceSecPerMile != null;

  return {
    hasActivityDetail,
    hasSegmentActuals,
    hasWorkSegmentActuals,
    analysisMode,
    requiresDetailForTargetAnalysis: requiresDetail,
    canJudgeTargetPace,
    workSegmentActual,
  };
}

/** Pace values used for target comparison in UI / coach feedback. */
export function resolveTargetComparisonPace(params: {
  analysis: WorkoutPerformanceAnalysis;
  workoutType: string;
  actualAvgPaceSecPerMile: number | null;
  paceDeltaSecPerMile: number | null;
  targetPaceSecPerMile: number | null;
  targetPaceSecPerMileHigh: number | null;
}): {
  actualPaceSecPerMile: number | null;
  paceDeltaSecPerMile: number | null;
  targetPaceSecPerMile: number | null;
  targetPaceSecPerMileHigh: number | null;
} {
  const { analysis } = params;
  if (!analysis.canJudgeTargetPace) {
    return {
      actualPaceSecPerMile: null,
      paceDeltaSecPerMile: null,
      targetPaceSecPerMile: params.targetPaceSecPerMile,
      targetPaceSecPerMileHigh: params.targetPaceSecPerMileHigh,
    };
  }

  if (
    analysis.requiresDetailForTargetAnalysis &&
    analysis.workSegmentActual?.actualPaceSecPerMile != null
  ) {
    return {
      actualPaceSecPerMile: analysis.workSegmentActual.actualPaceSecPerMile,
      paceDeltaSecPerMile: analysis.workSegmentActual.paceDeltaSecPerMile,
      targetPaceSecPerMile:
        analysis.workSegmentActual.targetPaceSecPerMile ?? params.targetPaceSecPerMile,
      targetPaceSecPerMileHigh:
        analysis.workSegmentActual.targetPaceSecPerMileHigh ??
        params.targetPaceSecPerMileHigh,
    };
  }

  return {
    actualPaceSecPerMile: params.actualAvgPaceSecPerMile,
    paceDeltaSecPerMile: params.paceDeltaSecPerMile,
    targetPaceSecPerMile: params.targetPaceSecPerMile,
    targetPaceSecPerMileHigh: params.targetPaceSecPerMileHigh,
  };
}
