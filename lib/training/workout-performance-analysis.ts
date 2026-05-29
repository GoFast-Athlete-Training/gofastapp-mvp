/**
 * Unified performance analysis: detail readiness + work-segment actuals (reps only).
 * Used by workout GET, AnalysisDeepPanel, coach feedback, and workout detail UI.
 */

import {
  normalizePaceTargetEncodingVersion,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import { paceVsTargetLabel, type PaceVsTargetLabel } from "@/lib/training/pace-comparison-display";
import {
  distanceStatus,
  distanceStatusBadgeText,
  distanceStatusMessage,
  type DistanceStatus,
} from "@/lib/training/run-result-status";
import { isRecoveryTitle } from "@/lib/training/segment-summary";
import { requiresDetailForTargetAnalysis } from "@/lib/training/structured-workout-types";

export { requiresDetailForTargetAnalysis } from "@/lib/training/structured-workout-types";

export type AnalysisMode = "detail" | "completion_only" | "summary_only";

export type SegmentPhase = "warmup" | "work" | "recovery" | "cooldown";

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

export type WorkRepsOnTarget = {
  onTarget: number;
  total: number;
};

export type WorkSegmentDelta = {
  segmentId: string;
  title: string;
  stepOrder: number;
  actualPaceSecPerMile: number | null;
  targetPaceSecPerMile: number | null;
  targetPaceSecPerMileHigh: number | null;
  /** target − actual; positive = faster than target */
  paceDeltaSecPerMile: number | null;
  vsTargetLabel: PaceVsTargetLabel;
  deltaDisplay: string;
};

export type TotalMilesScorecard = {
  actualMiles: number | null;
  plannedMiles: number | null;
  status: DistanceStatus;
  badge: string;
  message: string | null;
};

export type WorkEffortScorecard = {
  repsOnTarget: number | null;
  totalReps: number | null;
  workMilesOnTarget: number | null;
  totalWorkMiles: number | null;
  workMinutesOnTarget: number | null;
  totalWorkMinutes: number | null;
  workAvgPaceSecPerMile: number | null;
  summary: string | null;
};

export type WorkoutScorecard = {
  totalMiles: TotalMilesScorecard;
  workEffort: WorkEffortScorecard | null;
  workSegmentDeltas: WorkSegmentDelta[];
  completionOnlyMessage: string | null;
};

export type PhaseAwareLapRow = {
  lapOrder: number;
  lapIndex: number;
  segmentId: string;
  segmentTitle: string;
  phase: SegmentPhase;
  paceSecPerMile: number | null;
  avgHr: number | null;
  distanceMiles: number | null;
  targetPaceSecPerMile: number | null;
  targetPaceSecPerMileHigh: number | null;
  vsPlanPaceLabel: string;
  vsPlanTone: "neutral" | "good" | "fast" | "slow";
};

export type WorkoutPerformanceAnalysis = {
  hasActivityDetail: boolean;
  hasSegmentActuals: boolean;
  hasWorkSegmentActuals: boolean;
  analysisMode: AnalysisMode;
  requiresDetailForTargetAnalysis: boolean;
  canJudgeTargetPace: boolean;
  workSegmentActual: WorkSegmentActual | null;
  workRepsOnTarget: WorkRepsOnTarget | null;
  completionOnlyMessage: string | null;
  executionHeadline: string | null;
  phaseAwareLaps: PhaseAwareLapRow[];
  scorecard: WorkoutScorecard;
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
  segment_laps?: Array<{
    id?: string;
    lapIndex?: number;
    avgPaceSecPerMile?: number | null;
    avgHeartRate?: number | null;
    distanceMiles?: number | null;
  }>;
};

export type PerformanceAnalysisWorkoutInput = {
  workoutType: string;
  targetPaceSecPerMile: number | null;
  targetPaceSecPerMileHigh: number | null;
  paceDeltaSecPerMile: number | null;
  actualAvgPaceSecPerMile: number | null;
  actualDistanceMeters?: number | null;
  actualDurationSeconds?: number | null;
  estimatedDistanceInMeters?: number | null;
  completedActivityDetailJson?: unknown;
  matchedActivityId?: string | null;
  matched_activity?: {
    detailData?: unknown;
    hydratedAt?: Date | null;
  } | null;
  segments: PerformanceAnalysisSegmentInput[];
};

function isBookendTitle(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("warm") || t.includes("cool");
}

export function classifySegmentPhase(title: string | null | undefined): SegmentPhase {
  if (!title) return "work";
  const t = title.toLowerCase();
  if (t.includes("warm")) return "warmup";
  if (t.includes("cool")) return "cooldown";
  if (isRecoveryTitle(title)) return "recovery";
  return "work";
}

export function isWorkSegmentTitle(title: string | null | undefined): boolean {
  return classifySegmentPhase(title) === "work";
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

export function countWorkRepsOnTarget(
  workSegmentActual: WorkSegmentActual | null
): WorkRepsOnTarget | null {
  if (!workSegmentActual) return null;
  let onTarget = 0;
  let total = 0;
  for (const row of workSegmentActual.segments) {
    if (row.actualPaceSecPerMile == null) continue;
    total++;
    if (isWorkSegmentOnTarget(row)) onTarget++;
  }
  if (total === 0) return null;
  return { onTarget, total };
}

function isWorkSegmentOnTarget(row: WorkSegmentActualRow): boolean {
  if (row.actualPaceSecPerMile == null) return false;
  const label = paceVsTargetLabel(
    row.actualPaceSecPerMile,
    row.targetPaceSecPerMile,
    row.targetPaceSecPerMileHigh ?? row.targetPaceSecPerMile
  );
  return label === "in_range" || label === "faster";
}

export function formatWorkSegmentDeltaDisplay(row: WorkSegmentActualRow): string {
  if (row.actualPaceSecPerMile == null || row.targetPaceSecPerMile == null) return "—";
  const label = paceVsTargetLabel(
    row.actualPaceSecPerMile,
    row.targetPaceSecPerMile,
    row.targetPaceSecPerMileHigh ?? row.targetPaceSecPerMile
  );
  if (label === "in_range") return "On target";
  const delta = row.targetPaceSecPerMile - row.actualPaceSecPerMile;
  if (delta > 0) return `${Math.round(delta)}s/mi faster`;
  if (delta < 0) return `${Math.abs(Math.round(delta))}s/mi slower`;
  return "On target";
}

export function buildWorkSegmentDeltas(
  workSegmentActual: WorkSegmentActual | null
): WorkSegmentDelta[] {
  if (!workSegmentActual) return [];
  return workSegmentActual.segments
    .filter((row) => row.actualPaceSecPerMile != null)
    .map((row) => {
      const vsTargetLabel = paceVsTargetLabel(
        row.actualPaceSecPerMile,
        row.targetPaceSecPerMile,
        row.targetPaceSecPerMileHigh ?? row.targetPaceSecPerMile
      );
      const paceDeltaSecPerMile =
        row.targetPaceSecPerMile != null && row.actualPaceSecPerMile != null
          ? row.targetPaceSecPerMile - row.actualPaceSecPerMile
          : null;
      return {
        segmentId: row.segmentId,
        title: row.title,
        stepOrder: row.stepOrder,
        actualPaceSecPerMile: row.actualPaceSecPerMile,
        targetPaceSecPerMile: row.targetPaceSecPerMile,
        targetPaceSecPerMileHigh: row.targetPaceSecPerMileHigh,
        paceDeltaSecPerMile,
        vsTargetLabel,
        deltaDisplay: formatWorkSegmentDeltaDisplay(row),
      };
    })
    .sort((a, b) => a.stepOrder - b.stepOrder);
}

function computeWorkEffortScorecard(params: {
  workSegmentActual: WorkSegmentActual | null;
  workRepsOnTarget: WorkRepsOnTarget | null;
  canJudgeTargetPace: boolean;
  requiresDetail: boolean;
  actualAvgPaceSecPerMile: number | null;
  targetPaceSecPerMile: number | null;
  targetPaceSecPerMileHigh: number | null;
  paceDeltaSecPerMile: number | null;
}): WorkEffortScorecard | null {
  if (params.requiresDetail) {
    if (!params.canJudgeTargetPace || !params.workSegmentActual) return null;

    let workMilesOnTarget = 0;
    let totalWorkMiles = 0;
    let workMinutesOnTarget = 0;
    let totalWorkMinutes = 0;

    for (const row of params.workSegmentActual.segments) {
      const miles = row.actualDistanceMiles ?? 0;
      const minutes = (row.actualDurationSeconds ?? 0) / 60;
      if (miles > 0) totalWorkMiles += miles;
      if (minutes > 0) totalWorkMinutes += minutes;
      if (isWorkSegmentOnTarget(row)) {
        if (miles > 0) workMilesOnTarget += miles;
        if (minutes > 0) workMinutesOnTarget += minutes;
      }
    }

    const parts: string[] = [];
    if (params.workRepsOnTarget) {
      parts.push(
        `${params.workRepsOnTarget.onTarget} of ${params.workRepsOnTarget.total} reps on target`
      );
    }
    if (totalWorkMiles > 0) {
      parts.push(
        `${workMilesOnTarget.toFixed(1)} of ${totalWorkMiles.toFixed(1)} work mi on target`
      );
    } else if (totalWorkMinutes > 0) {
      parts.push(
        `${Math.round(workMinutesOnTarget)} of ${Math.round(totalWorkMinutes)} work min on target`
      );
    }

    return {
      repsOnTarget: params.workRepsOnTarget?.onTarget ?? null,
      totalReps: params.workRepsOnTarget?.total ?? null,
      workMilesOnTarget: totalWorkMiles > 0 ? workMilesOnTarget : null,
      totalWorkMiles: totalWorkMiles > 0 ? totalWorkMiles : null,
      workMinutesOnTarget: totalWorkMinutes > 0 ? workMinutesOnTarget : null,
      totalWorkMinutes: totalWorkMinutes > 0 ? totalWorkMinutes : null,
      workAvgPaceSecPerMile: params.workSegmentActual.actualPaceSecPerMile,
      summary: parts.length > 0 ? parts.join(" · ") : null,
    };
  }

  if (!params.canJudgeTargetPace || params.actualAvgPaceSecPerMile == null) return null;

  const label = paceVsTargetLabel(
    params.actualAvgPaceSecPerMile,
    params.targetPaceSecPerMile,
    params.targetPaceSecPerMileHigh ?? params.targetPaceSecPerMile
  );
  let summary: string | null = null;
  if (label === "in_range") summary = "Pace in range";
  else if (label === "faster") summary = "Pace faster than target";
  else if (label === "slower") summary = "Pace slower than target";

  return {
    repsOnTarget: null,
    totalReps: null,
    workMilesOnTarget: null,
    totalWorkMiles: null,
    workMinutesOnTarget: null,
    totalWorkMinutes: null,
    workAvgPaceSecPerMile: params.actualAvgPaceSecPerMile,
    summary,
  };
}

export function computeWorkoutScorecard(params: {
  workout: PerformanceAnalysisWorkoutInput;
  analysis: Omit<WorkoutPerformanceAnalysis, "scorecard">;
}): WorkoutScorecard {
  const { workout, analysis } = params;
  const actualMiles =
    workout.actualDistanceMeters != null && workout.actualDistanceMeters > 0
      ? workout.actualDistanceMeters / 1609.34
      : null;
  const plannedMiles =
    workout.estimatedDistanceInMeters != null && workout.estimatedDistanceInMeters > 0
      ? workout.estimatedDistanceInMeters / 1609.34
      : null;
  const distStatus = distanceStatus(
    workout.estimatedDistanceInMeters,
    workout.actualDistanceMeters
  );

  const workEffort =
    analysis.analysisMode === "completion_only"
      ? null
      : computeWorkEffortScorecard({
          workSegmentActual: analysis.workSegmentActual,
          workRepsOnTarget: analysis.workRepsOnTarget,
          canJudgeTargetPace: analysis.canJudgeTargetPace,
          requiresDetail: analysis.requiresDetailForTargetAnalysis,
          actualAvgPaceSecPerMile: workout.actualAvgPaceSecPerMile,
          targetPaceSecPerMile: workout.targetPaceSecPerMile,
          targetPaceSecPerMileHigh: workout.targetPaceSecPerMileHigh,
          paceDeltaSecPerMile: workout.paceDeltaSecPerMile,
        });

  return {
    totalMiles: {
      actualMiles,
      plannedMiles,
      status: distStatus,
      badge: distanceStatusBadgeText(distStatus),
      message: distanceStatusMessage(
        workout.estimatedDistanceInMeters,
        workout.actualDistanceMeters
      ),
    },
    workEffort,
    workSegmentDeltas: buildWorkSegmentDeltas(analysis.workSegmentActual),
    completionOnlyMessage: analysis.completionOnlyMessage,
  };
}

export function formatCompletionOnlyMessage(params: {
  actualDistanceMeters?: number | null;
  actualDurationSeconds?: number | null;
}): string {
  const parts: string[] = ["Nice work"];
  const detailParts: string[] = [];
  if (params.actualDistanceMeters != null && params.actualDistanceMeters > 0) {
    detailParts.push(`you completed ${(params.actualDistanceMeters / 1609.34).toFixed(2)} mi`);
  }
  if (params.actualDurationSeconds != null && params.actualDurationSeconds > 0) {
    detailParts.push(`in ${Math.round(params.actualDurationSeconds / 60)} min`);
  }
  if (detailParts.length > 0) {
    parts.push(`— ${detailParts.join(" ")}`);
  }
  return `${parts.join(" ")}.`;
}

function formatStructuredExecutionHeadline(
  workRepsOnTarget: WorkRepsOnTarget | null,
  workSegmentActual: WorkSegmentActual | null
): string | null {
  if (workRepsOnTarget) {
    return `${workRepsOnTarget.onTarget} of ${workRepsOnTarget.total} work reps on target`;
  }
  if (workSegmentActual?.actualPaceSecPerMile != null) {
    return "Work rep pace available";
  }
  return null;
}

function formatEasyLongExecutionHeadline(params: {
  segments: PerformanceAnalysisSegmentInput[];
  workoutTargetLow: number | null;
  workoutTargetHigh: number | null;
}): string | null {
  const laps = buildPhaseAwareLapRows({
    segments: params.segments,
    workoutTargetLow: params.workoutTargetLow,
    workoutTargetHigh: params.workoutTargetHigh,
  }).filter((lap) => lap.phase === "work" && lap.paceSecPerMile != null);

  if (laps.length === 0) return null;

  let onTarget = 0;
  for (const lap of laps) {
    const label = paceVsTargetLabel(
      lap.paceSecPerMile,
      lap.targetPaceSecPerMile ?? params.workoutTargetLow,
      lap.targetPaceSecPerMileHigh ??
        params.workoutTargetHigh ??
        lap.targetPaceSecPerMile ??
        params.workoutTargetLow
    );
    if (label === "in_range" || label === "faster") onTarget++;
  }

  const unit = laps.length === 1 ? "mile" : "miles";
  return `${onTarget} of ${laps.length} ${unit} on target`;
}

export function phaseAwareVsPlanPaceLabel(params: {
  phase: SegmentPhase;
  paceSecPerMile: number | null;
  targetPaceSecPerMile: number | null;
  targetPaceSecPerMileHigh: number | null;
}): { label: string; tone: PhaseAwareLapRow["vsPlanTone"] } {
  if (params.phase === "warmup") return { label: "Warmup", tone: "neutral" };
  if (params.phase === "cooldown") return { label: "Cooldown", tone: "neutral" };
  if (params.phase === "recovery") return { label: "Recovery", tone: "neutral" };

  if (params.paceSecPerMile == null || params.targetPaceSecPerMile == null) {
    return { label: "—", tone: "neutral" };
  }

  const label = paceVsTargetLabel(
    params.paceSecPerMile,
    params.targetPaceSecPerMile,
    params.targetPaceSecPerMileHigh ?? params.targetPaceSecPerMile
  );

  if (label === "in_range") return { label: "In range", tone: "good" };
  if (label === "faster") return { label: "Faster", tone: "fast" };
  if (label === "slower") return { label: "Slower", tone: "slow" };
  return { label: "—", tone: "neutral" };
}

export function buildPhaseAwareLapRows(params: {
  segments: PerformanceAnalysisSegmentInput[];
  workoutTargetLow: number | null;
  workoutTargetHigh: number | null;
}): PhaseAwareLapRow[] {
  const sorted = [...params.segments].sort((a, b) => a.stepOrder - b.stepOrder);
  type LapEntry = {
    lap: NonNullable<PerformanceAnalysisSegmentInput["segment_laps"]>[number];
    segment: PerformanceAnalysisSegmentInput;
  };
  const flat: LapEntry[] = [];
  for (const segment of sorted) {
    for (const lap of segment.segment_laps ?? []) {
      flat.push({ lap, segment });
    }
  }
  flat.sort((a, b) => {
    const ai = a.lap.lapIndex ?? 0;
    const bi = b.lap.lapIndex ?? 0;
    if (ai !== bi) return ai - bi;
    return a.segment.stepOrder - b.segment.stepOrder;
  });

  const rows: PhaseAwareLapRow[] = [];
  let lapOrder = 0;
  for (const { lap, segment } of flat) {
    lapOrder += 1;
    const phase = classifySegmentPhase(segment.title);
    const segmentTargetLow = paceTargetSecPerMileFromSegment(
      segment.targets,
      segment.paceTargetEncodingVersion
    );
    const segmentTargetHigh = paceTargetHighSecPerMileFromSegment(
      segment.targets,
      segment.paceTargetEncodingVersion
    );
    const targetLow =
      phase === "work" ? (segmentTargetLow ?? params.workoutTargetLow) : null;
    const targetHigh =
      phase === "work"
        ? (segmentTargetHigh ?? params.workoutTargetHigh ?? targetLow)
        : null;
    const vs = phaseAwareVsPlanPaceLabel({
      phase,
      paceSecPerMile: lap.avgPaceSecPerMile ?? null,
      targetPaceSecPerMile: targetLow,
      targetPaceSecPerMileHigh: targetHigh,
    });
    rows.push({
      lapOrder,
      lapIndex: lap.lapIndex ?? lapOrder - 1,
      segmentId: segment.id,
      segmentTitle: segment.title,
      phase,
      paceSecPerMile: lap.avgPaceSecPerMile ?? null,
      avgHr: lap.avgHeartRate ?? null,
      distanceMiles: lap.distanceMiles ?? null,
      targetPaceSecPerMile: targetLow,
      targetPaceSecPerMileHigh: targetHigh,
      vsPlanPaceLabel: vs.label,
      vsPlanTone: vs.tone,
    });
  }

  return rows;
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

/**
 * Structured execution detail: exactly one persisted lap per segment row (lap[i] → segment[i]).
 */
export function structuredSegmentLapsAligned(
  segments: PerformanceAnalysisSegmentInput[]
): boolean {
  if (segments.length === 0) return false;
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  return sorted.every((s) => (s.segment_laps?.length ?? 0) === 1);
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
  const segmentLapsAligned = structuredSegmentLapsAligned(workout.segments);
  const hasTrustworthyStructuredDetail =
    requiresDetail &&
    hasActivityDetail &&
    segmentLapsAligned &&
    hasWorkSegmentActuals;

  let analysisMode: AnalysisMode;
  if (requiresDetail) {
    if (hasTrustworthyStructuredDetail) {
      analysisMode = "detail";
    } else {
      analysisMode = "completion_only";
    }
  } else if (hasActivityDetail || hasSegmentActuals) {
    analysisMode = "detail";
  } else {
    analysisMode = "summary_only";
  }

  const workSegmentActual = hasTrustworthyStructuredDetail
    ? computeWorkSegmentActual(
        workout.segments,
        workout.targetPaceSecPerMile,
        workout.targetPaceSecPerMileHigh
      )
    : !requiresDetail && (hasWorkSegmentActuals || hasSegmentActuals)
      ? computeWorkSegmentActual(
          workout.segments,
          workout.targetPaceSecPerMile,
          workout.targetPaceSecPerMileHigh
        )
      : null;

  const canJudgeTargetPace = requiresDetail
    ? analysisMode === "detail" &&
      (workSegmentActual?.actualPaceSecPerMile != null ||
        (workSegmentActual?.segments.some((s) => s.actualPaceSecPerMile != null) ?? false))
    : analysisMode === "detail"
      ? Boolean(
          workSegmentActual?.actualPaceSecPerMile != null ||
            buildPhaseAwareLapRows({
              segments: workout.segments,
              workoutTargetLow: workout.targetPaceSecPerMile,
              workoutTargetHigh: workout.targetPaceSecPerMileHigh,
            }).some((lap) => lap.phase === "work" && lap.paceSecPerMile != null)
        )
      : workout.actualAvgPaceSecPerMile != null ||
        workSegmentActual?.actualPaceSecPerMile != null;

  const workRepsOnTarget =
    requiresDetail && canJudgeTargetPace
      ? countWorkRepsOnTarget(workSegmentActual)
      : null;

  const completionOnlyMessage =
    analysisMode === "completion_only"
      ? formatCompletionOnlyMessage({
          actualDistanceMeters: workout.actualDistanceMeters,
          actualDurationSeconds: workout.actualDurationSeconds,
        })
      : null;

  let executionHeadline: string | null = null;
  if (analysisMode === "completion_only") {
    executionHeadline = completionOnlyMessage;
  } else if (requiresDetail && canJudgeTargetPace) {
    executionHeadline = formatStructuredExecutionHeadline(workRepsOnTarget, workSegmentActual);
  } else if (!requiresDetail && analysisMode === "detail" && canJudgeTargetPace) {
    executionHeadline = formatEasyLongExecutionHeadline({
      segments: workout.segments,
      workoutTargetLow: workout.targetPaceSecPerMile,
      workoutTargetHigh: workout.targetPaceSecPerMileHigh,
    });
  }

  const phaseAwareLaps =
    !requiresDetail || segmentLapsAligned
      ? buildPhaseAwareLapRows({
          segments: workout.segments,
          workoutTargetLow: workout.targetPaceSecPerMile,
          workoutTargetHigh: workout.targetPaceSecPerMileHigh,
        })
      : [];

  const analysisWithoutScorecard = {
    hasActivityDetail,
    hasSegmentActuals,
    hasWorkSegmentActuals,
    analysisMode,
    requiresDetailForTargetAnalysis: requiresDetail,
    canJudgeTargetPace,
    workSegmentActual,
    workRepsOnTarget,
    completionOnlyMessage,
    executionHeadline,
    phaseAwareLaps,
  };

  const scorecard = computeWorkoutScorecard({
    workout,
    analysis: analysisWithoutScorecard,
  });

  return {
    ...analysisWithoutScorecard,
    scorecard,
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

  if (analysis.requiresDetailForTargetAnalysis) {
    return {
      actualPaceSecPerMile: null,
      paceDeltaSecPerMile: null,
      targetPaceSecPerMile: params.targetPaceSecPerMile,
      targetPaceSecPerMileHigh: params.targetPaceSecPerMileHigh,
    };
  }

  if (analysis.workSegmentActual?.actualPaceSecPerMile != null) {
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
