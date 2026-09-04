/**
 * One analyzer job: mutate pace delta on the lap.
 * translatePlannedOntoWorkout — pure in memory.
 * writeLapPaceDeltas — only DB write on workout_segment_laps.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  classifySegmentPhase,
  isWorkSegmentTitle,
} from "./workout-performance-analysis";
import { isRecoveryTitle } from "./segment-summary";
import {
  normalizePaceTargetEncodingVersion,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import { computeBandPaceDelta } from "./pace-comparison-display";

export const NO_DETAIL_SUPPORT_MESSAGE = "Splits aren't available.";

export type PlannedSegmentRow = {
  id: string;
  stepOrder: number;
  title: string;
  targets: Prisma.JsonValue;
  paceTargetEncodingVersion: number;
  repeatCount: number | null;
  recoveryDurationType: string | null;
  recoveryDurationValue: number | null;
};

export type WorkoutLapRow = {
  id: string;
  lapIndex: number;
  segmentId: string;
  segmentTitle: string;
  segmentStepOrder: number;
  avgPaceSecPerMile: number | null;
};

export type AimedLap = {
  lapId: string;
  prescribedPaceMinSecPerMile: number | null;
  prescribedPaceMaxSecPerMile: number | null;
  paceDeltaSecPerMile: number | null;
};

type SegmentTarget = { type?: string; valueLow?: number; value?: number; valueHigh?: number };

function paceBandFromTargets(
  targets: unknown,
  paceTargetEncodingVersion: number
): { min: number | null; max: number | null } {
  if (!Array.isArray(targets) || targets.length === 0) {
    return { min: null, max: null };
  }
  const t = targets[0] as SegmentTarget;
  if (!t?.type || String(t.type).toUpperCase() !== "PACE") {
    return { min: null, max: null };
  }
  const lowRaw = t.valueLow ?? t.value;
  if (lowRaw == null || typeof lowRaw !== "number" || lowRaw <= 0) {
    return { min: null, max: null };
  }
  const enc = normalizePaceTargetEncodingVersion(paceTargetEncodingVersion);
  const min = Math.round(storedPaceSecondsKmToSecondsPerMile(lowRaw, enc));
  let max: number | null = null;
  if (t.valueHigh != null && typeof t.valueHigh === "number" && t.valueHigh > 0) {
    max = Math.round(storedPaceSecondsKmToSecondsPerMile(t.valueHigh, enc));
  }
  return { min, max: max ?? min };
}

function computeLapDelta(
  actualPaceSecPerMile: number | null,
  min: number | null,
  max: number | null
): number | null {
  if (actualPaceSecPerMile == null || min == null) return null;
  return computeBandPaceDelta(actualPaceSecPerMile, min, max);
}

function openAimedLap(lapId: string): AimedLap {
  return {
    lapId,
    prescribedPaceMinSecPerMile: null,
    prescribedPaceMaxSecPerMile: null,
    paceDeltaSecPerMile: null,
  };
}

function aimedWorkLap(
  lapId: string,
  avgPaceSecPerMile: number | null,
  min: number,
  max: number | null
): AimedLap {
  return {
    lapId,
    prescribedPaceMinSecPerMile: min,
    prescribedPaceMaxSecPerMile: max,
    paceDeltaSecPerMile: computeLapDelta(avgPaceSecPerMile, min, max),
  };
}

/** Odd lap indices within a repeat block are recovery jogs (OPEN). */
function isRecoveryLapWithinRepeatBlock(lapIndexInSegment: number): boolean {
  return lapIndexInSegment % 2 === 1;
}

type ExpandedPrescription =
  | { kind: "work"; min: number; max: number | null }
  | { kind: "open" };

/** Expand compact plan rows (including repeatCount) into per-lap prescriptions in order. */
export function expandPlannedToLapPrescriptions(
  plannedSegments: PlannedSegmentRow[]
): ExpandedPrescription[] {
  const sorted = [...plannedSegments].sort((a, b) => a.stepOrder - b.stepOrder);
  const out: ExpandedPrescription[] = [];

  for (const seg of sorted) {
    const phase = classifySegmentPhase(seg.title);
    const band = paceBandFromTargets(seg.targets, seg.paceTargetEncodingVersion);
    const repeats = seg.repeatCount != null && seg.repeatCount > 1 ? seg.repeatCount : 1;
    const hasRecovery =
      seg.recoveryDurationType != null &&
      seg.recoveryDurationType !== "NONE" &&
      seg.recoveryDurationValue != null &&
      seg.recoveryDurationValue > 0;

    if (phase === "work" && band.min != null && repeats > 1) {
      for (let i = 0; i < repeats; i += 1) {
        out.push({ kind: "work", min: band.min, max: band.max });
        if (hasRecovery && i < repeats - 1) {
          out.push({ kind: "open" });
        }
      }
      continue;
    }

    if (phase === "work" && band.min != null) {
      out.push({ kind: "work", min: band.min, max: band.max });
      continue;
    }

    // Warmup, cooldown, recovery, or OPEN work (long run bookends)
    const lapCount = repeats;
    for (let i = 0; i < lapCount; i += 1) {
      if (phase === "work" && band.min != null) {
        out.push({ kind: "work", min: band.min, max: band.max });
      } else {
        out.push({ kind: "open" });
      }
    }
  }

  return out;
}

/** True when recovery jogs landed on a separate Recovery segment row (modular mile repeats). */
function plannedHasRecoverySegmentWithLaps(
  plannedSegments: PlannedSegmentRow[],
  sortedLaps: WorkoutLapRow[]
): boolean {
  return plannedSegments.some(
    (s) =>
      isRecoveryTitle(s.title) &&
      sortedLaps.some((l) => l.segmentStepOrder === s.stepOrder)
  );
}

/** Multiple laps on one repeatCount row → alternate work/recovery only when mixed on same segment. */
function repeatBlockNeedsSegmentPath(
  plannedSegments: PlannedSegmentRow[],
  sortedLaps: WorkoutLapRow[]
): boolean {
  const modularSeparateRecovery = plannedHasRecoverySegmentWithLaps(
    plannedSegments,
    sortedLaps
  );

  for (const seg of plannedSegments) {
    const reps = seg.repeatCount ?? 1;
    if (reps <= 1) continue;
    const lapsOnSeg = sortedLaps.filter((l) => l.segmentStepOrder === seg.stepOrder);
    if (lapsOnSeg.length <= 1) continue;

    if (
      modularSeparateRecovery &&
      isWorkSegmentTitle(seg.title) &&
      !lapsOnSeg.some((l) => isRecoveryTitle(l.segmentTitle))
    ) {
      continue;
    }

    return true;
  }
  return false;
}

/** Map prescriptions onto detected workout laps in lapIndex order. Fail open on count mismatch. */
export function translatePlannedOntoWorkout(params: {
  plannedSegments: PlannedSegmentRow[];
  workoutLaps: WorkoutLapRow[];
}): AimedLap[] {
  const { plannedSegments, workoutLaps } = params;
  const sortedLaps = [...workoutLaps].sort((a, b) => a.lapIndex - b.lapIndex);
  const lapIndexInSegment = new Map<string, number>();

  // Segment-path: assign prescribe from each workout segment's targets to its laps
  const segmentPath = sortedLaps.map((lap) => {
    const phase = classifySegmentPhase(lap.segmentTitle);
    const seg = plannedSegments.find((s) => s.stepOrder === lap.segmentStepOrder);
    const band = seg
      ? paceBandFromTargets(seg.targets, seg.paceTargetEncodingVersion)
      : { min: null, max: null };

    const isRecoveryLap = isRecoveryTitle(lap.segmentTitle) || phase === "recovery";
    const isOpen =
      isRecoveryLap || phase === "warmup" || phase === "cooldown" || band.min == null;

    if (isOpen) {
      return openAimedLap(lap.id);
    }

    const reps = seg?.repeatCount ?? 1;
    const usesSameSegmentAlternation =
      reps > 1 &&
      phase === "work" &&
      !isRecoveryTitle(lap.segmentTitle) &&
      band.min != null &&
      !plannedHasRecoverySegmentWithLaps(plannedSegments, sortedLaps) &&
      sortedLaps.filter((l) => l.segmentId === lap.segmentId).length > 1;

    if (usesSameSegmentAlternation) {
      const idx = lapIndexInSegment.get(lap.segmentId) ?? 0;
      lapIndexInSegment.set(lap.segmentId, idx + 1);
      if (isRecoveryLapWithinRepeatBlock(idx)) {
        return openAimedLap(lap.id);
      }
    }

    return aimedWorkLap(lap.id, lap.avgPaceSecPerMile, band.min!, band.max);
  });

  const expanded = expandPlannedToLapPrescriptions(plannedSegments);
  const workLaps = sortedLaps.filter(
    (l) =>
      isWorkSegmentTitle(l.segmentTitle) &&
      !isRecoveryTitle(l.segmentTitle) &&
      l.avgPaceSecPerMile != null
  );

  if (repeatBlockNeedsSegmentPath(plannedSegments, sortedLaps)) {
    return segmentPath;
  }

  // When expanded plan count matches work laps, prefer expanded mapping for repeats/MP
  if (expanded.length > 0 && expanded.length === sortedLaps.length) {
    return sortedLaps.map((lap, i) => {
      const rx = expanded[i]!;
      if (rx.kind === "open") {
        return openAimedLap(lap.id);
      }
      return aimedWorkLap(lap.id, lap.avgPaceSecPerMile, rx.min, rx.max);
    });
  }

  if (expanded.filter((e) => e.kind === "work").length === workLaps.length && workLaps.length > 0) {
    let workIdx = 0;
    return sortedLaps.map((lap) => {
      const phase = classifySegmentPhase(lap.segmentTitle);
      const isWork =
        phase === "work" &&
        !isRecoveryTitle(lap.segmentTitle) &&
        lap.avgPaceSecPerMile != null;
      if (!isWork) {
        return openAimedLap(lap.id);
      }
      const rx = expanded.filter((e) => e.kind === "work")[workIdx] as Extract<
        ExpandedPrescription,
        { kind: "work" }
      >;
      workIdx += 1;
      return aimedWorkLap(lap.id, lap.avgPaceSecPerMile, rx.min, rx.max);
    });
  }

  return segmentPath;
}

export async function writeLapPaceDeltas(aimed: AimedLap[]): Promise<number> {
  const now = new Date();
  let written = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of aimed) {
      await tx.workout_segment_laps.update({
        where: { id: row.lapId },
        data: {
          prescribedPaceMinSecPerMile: row.prescribedPaceMinSecPerMile,
          prescribedPaceMaxSecPerMile: row.prescribedPaceMaxSecPerMile,
          paceDeltaSecPerMile: row.paceDeltaSecPerMile,
          updatedAt: now,
        },
      });
      if (row.paceDeltaSecPerMile != null) written += 1;
    }
  });
  return written;
}

export type AnalyzeWorkoutPaceResult =
  | { ok: true; lapCount: number; deltasWritten: number }
  | { ok: false; code: "NO_LAPS" | "NO_SEGMENTS"; message: string };

export async function analyzeWorkoutPaceDeltas(params: {
  workoutId: string;
  activityId: string;
}): Promise<AnalyzeWorkoutPaceResult> {
  const workout = await prisma.workouts.findUnique({
    where: { id: params.workoutId },
    select: {
      id: true,
      plannedWorkoutId: true,
      segments: {
        orderBy: { stepOrder: "asc" },
        select: {
          id: true,
          stepOrder: true,
          title: true,
          targets: true,
          paceTargetEncodingVersion: true,
          repeatCount: true,
          recoveryDurationType: true,
          recoveryDurationValue: true,
          segment_laps: {
            where: { activityId: params.activityId },
            orderBy: { lapIndex: "asc" },
            select: {
              id: true,
              lapIndex: true,
              avgPaceSecPerMile: true,
            },
          },
        },
      },
    },
  });

  if (!workout || workout.segments.length === 0) {
    return { ok: false, code: "NO_SEGMENTS", message: "Workout has no segments." };
  }

  let plannedSegments: PlannedSegmentRow[] = workout.segments.map((s) => ({
    id: s.id,
    stepOrder: s.stepOrder,
    title: s.title,
    targets: s.targets,
    paceTargetEncodingVersion: s.paceTargetEncodingVersion,
    repeatCount: s.repeatCount,
    recoveryDurationType: s.recoveryDurationType,
    recoveryDurationValue: s.recoveryDurationValue,
  }));

  if (workout.plannedWorkoutId) {
    const planned = await prisma.planned_workout_segments.findMany({
      where: { plannedWorkoutId: workout.plannedWorkoutId },
      orderBy: { stepOrder: "asc" },
      select: {
        id: true,
        stepOrder: true,
        title: true,
        targets: true,
        paceTargetEncodingVersion: true,
        repeatCount: true,
        recoveryDurationType: true,
        recoveryDurationValue: true,
      },
    });
    if (planned.length > 0) {
      plannedSegments = planned;
    }
  }

  const workoutLaps: WorkoutLapRow[] = [];
  for (const seg of workout.segments) {
    for (const lap of seg.segment_laps) {
      workoutLaps.push({
        id: lap.id,
        lapIndex: lap.lapIndex,
        segmentId: seg.id,
        segmentTitle: seg.title,
        segmentStepOrder: seg.stepOrder,
        avgPaceSecPerMile: lap.avgPaceSecPerMile,
      });
    }
  }

  if (workoutLaps.length === 0) {
    return { ok: false, code: "NO_LAPS", message: "No laps found for this activity." };
  }

  const aimed = translatePlannedOntoWorkout({ plannedSegments, workoutLaps });
  const deltasWritten = await writeLapPaceDeltas(aimed);

  await prisma.workouts.update({
    where: { id: params.workoutId },
    data: {
      segmentExecutionStatus: "ALIGNED",
      segmentExecutionLapCount: workoutLaps.length,
      segmentExecutionSegmentCount: workout.segments.length,
      evaluationEligibleFlag: deltasWritten > 0,
      updatedAt: new Date(),
    },
  });

  return { ok: true, lapCount: workoutLaps.length, deltasWritten };
}

export function workoutHasLapPaceDeltas(
  segments: Array<{ segment_laps?: Array<{ paceDeltaSecPerMile?: number | null }> }>
): boolean {
  for (const seg of segments) {
    for (const lap of seg.segment_laps ?? []) {
      if (lap.paceDeltaSecPerMile != null && Number.isFinite(lap.paceDeltaSecPerMile)) {
        return true;
      }
    }
  }
  return false;
}
