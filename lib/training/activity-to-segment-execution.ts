/**
 * Activity-to-segment parser + mutation service.
 *
 * Raw Garmin detail stays on athlete_activities.detailData.
 * After match, normalized activity laps are assigned to ordered workout_segments
 * and persisted as workout_segment_laps + segment actuals.
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  assignLapsToSegments,
  type LapAssignment,
  type LapAssignmentMode,
} from "./lap-data-to-workout";
import { normalizeActivityLapsFromDetail, type DerivedLap } from "./lap-converter";
import {
  normalizePaceTargetEncodingVersion,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";

export type SegmentExecutionStatus = "ALIGNED" | "ALIGNMENT_FAILED";

export type SegmentExecutionResult =
  | {
      ok: true;
      status: "ALIGNED";
      mode: LapAssignmentMode;
      lapCount: number;
      segmentCount: number;
    }
  | {
      ok: false;
      status: "NO_DETAIL" | "NO_WORKOUT" | "NO_SEGMENTS" | "NO_LAPS" | "ALIGNMENT_FAILED";
      lapCount?: number;
      segmentCount?: number;
      message: string;
    };

type BaseSeg = {
  id: string;
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  repeatCount: number | null;
  targets: Prisma.JsonValue;
  paceTargetEncodingVersion: number;
};

function paceTargetSecPerMileFromTargets(
  targets: unknown,
  paceTargetEncodingVersion: number
): number | null {
  if (!Array.isArray(targets) || targets.length === 0) return null;
  const t = targets[0] as { type?: string; valueLow?: number; value?: number };
  if (!t?.type || String(t.type).toUpperCase() !== "PACE") return null;
  const low = t.valueLow ?? t.value;
  if (low == null || typeof low !== "number" || low <= 0) return null;
  const enc = normalizePaceTargetEncodingVersion(paceTargetEncodingVersion);
  return Math.round(storedPaceSecondsKmToSecondsPerMile(low, enc));
}

function recomputeSegmentAggregates(laps: DerivedLap[]) {
  let totalDur = 0;
  let totalDist = 0;
  let paceWeighted = 0;
  let paceW = 0;
  for (const l of laps) {
    if (l.durationSeconds > 0) totalDur += l.durationSeconds;
    if (l.distanceMiles != null && l.distanceMiles > 0) {
      totalDist += l.distanceMiles;
    }
    if (l.avgPaceSecPerMile != null && l.durationSeconds > 0) {
      paceWeighted += l.avgPaceSecPerMile * l.durationSeconds;
      paceW += l.durationSeconds;
    }
  }
  const pace = paceW > 0 ? Math.round(paceWeighted / paceW) : null;
  return {
    actualPaceSecPerMile: pace,
    actualDistanceMiles:
      totalDist > 0 ? Math.round(totalDist * 100) / 100 : null,
    actualDurationSeconds: totalDur > 0 ? Math.round(totalDur) : null,
  };
}

async function clearWorkoutSegmentExecution(
  tx: Prisma.TransactionClient,
  workout: { id: string; segments: { id: string }[] },
  activityId: string
): Promise<void> {
  await tx.workout_segment_laps.deleteMany({
    where: {
      activityId,
      segment: { workoutId: workout.id },
    },
  });
  for (const seg of workout.segments) {
    await tx.workout_segments.update({
      where: { id: seg.id },
      data: {
        actualPaceSecPerMile: null,
        actualDistanceMiles: null,
        actualDurationSeconds: null,
        updatedAt: new Date(),
      },
    });
  }
  await tx.workouts.update({
    where: { id: workout.id },
    data: {
      paceDeltaSecPerMile: null,
      evaluationEligibleFlag: false,
      segmentExecutionStatus: null,
      segmentExecutionLapCount: null,
      segmentExecutionSegmentCount: null,
      updatedAt: new Date(),
    },
  });
}

async function mutateSegmentExecution(params: {
  activityId: string;
  workout: {
    id: string;
    workoutType: string;
    segments: BaseSeg[];
  };
  derived: DerivedLap[];
  assignment: LapAssignment;
}): Promise<void> {
  const { activityId, workout, derived, assignment } = params;
  const { mode, bySegment } = assignment;

  const toCreate: Prisma.workout_segment_lapsCreateManyInput[] = [];
  for (const [segmentId, laps] of bySegment) {
    for (const d of laps) {
      toCreate.push({
        id: randomUUID(),
        activityId,
        segmentId,
        lapIndex: d.lapIndex,
        startTimeInSeconds: d.startTimeInSeconds,
        endTimeInSeconds: d.endTimeInSeconds,
        avgPaceSecPerMile: d.avgPaceSecPerMile,
        avgHeartRate: d.avgHeartRate,
        distanceMiles: d.distanceMiles,
        durationSeconds: d.durationSeconds,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await clearWorkoutSegmentExecution(tx, workout, activityId);

    if (toCreate.length > 0) {
      await tx.workout_segment_laps.createMany({ data: toCreate });
    }

    for (const seg of workout.segments) {
      const ls = bySegment.get(seg.id) ?? [];
      if (ls.length === 0) continue;
      const agg = recomputeSegmentAggregates(ls);
      await tx.workout_segments.update({
        where: { id: seg.id },
        data: {
          ...agg,
          updatedAt: new Date(),
        },
      });
    }

    const deltas: number[] = [];
    if (mode === "step") {
      const sorted = [...workout.segments].sort(
        (a, b) => a.stepOrder - b.stepOrder
      );
      for (let i = 0; i < derived.length && i < sorted.length; i++) {
        const seg = sorted[i]!;
        const target = paceTargetSecPerMileFromTargets(
          seg.targets,
          seg.paceTargetEncodingVersion
        );
        const act = derived[i]!.avgPaceSecPerMile;
        if (target != null && act != null) {
          deltas.push(target - act);
        }
      }
    } else {
      for (const seg of workout.segments) {
        const target = paceTargetSecPerMileFromTargets(
          seg.targets,
          seg.paceTargetEncodingVersion
        );
        const ls2 = bySegment.get(seg.id) ?? [];
        if (ls2.length === 0) continue;
        const agg2 = recomputeSegmentAggregates(ls2);
        if (target != null && agg2.actualPaceSecPerMile != null) {
          deltas.push(target - agg2.actualPaceSecPerMile);
        }
      }
    }

    const workoutUpdate: Prisma.workoutsUpdateInput = {
      segmentExecutionStatus: "ALIGNED",
      segmentExecutionLapCount: derived.length,
      segmentExecutionSegmentCount: workout.segments.length,
      updatedAt: new Date(),
    };
    if (deltas.length > 0) {
      workoutUpdate.paceDeltaSecPerMile = Math.round(
        deltas.reduce((a, b) => a + b, 0) / deltas.length
      );
      workoutUpdate.evaluationEligibleFlag = true;
    }
    await tx.workouts.update({
      where: { id: workout.id },
      data: workoutUpdate,
    });
  });
}

async function recordAlignmentFailure(params: {
  activityId: string;
  workout: { id: string; segments: { id: string }[] };
  lapCount: number;
  segmentCount: number;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await clearWorkoutSegmentExecution(tx, params.workout, params.activityId);
    await tx.workouts.update({
      where: { id: params.workout.id },
      data: {
        segmentExecutionStatus: "ALIGNMENT_FAILED",
        segmentExecutionLapCount: params.lapCount,
        segmentExecutionSegmentCount: params.segmentCount,
        updatedAt: new Date(),
      },
    });
  });
}

/**
 * Parse raw activity detail into segment execution for a matched workout.
 */
export async function parseActivityToSegmentExecution(params: {
  activityId: string;
  workoutId?: string;
}): Promise<SegmentExecutionResult> {
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: params.activityId },
    select: { id: true, detailData: true },
  });
  if (!activity?.detailData || typeof activity.detailData !== "object") {
    return {
      ok: false,
      status: "NO_DETAIL",
      message: "No activity detail available",
    };
  }

  const workout = params.workoutId
    ? await prisma.workouts.findUnique({
        where: { id: params.workoutId },
        include: { segments: { orderBy: { stepOrder: "asc" } } },
      })
    : await prisma.workouts.findFirst({
        where: { matchedActivityId: params.activityId },
        include: { segments: { orderBy: { stepOrder: "asc" } } },
      });

  if (!workout) {
    return {
      ok: false,
      status: "NO_WORKOUT",
      message: "No matched workout for activity",
    };
  }

  if (workout.matchedActivityId && workout.matchedActivityId !== params.activityId) {
    return {
      ok: false,
      status: "NO_WORKOUT",
      message: "Activity is not matched to this workout",
    };
  }

  if (!workout.segments.length) {
    return {
      ok: false,
      status: "NO_SEGMENTS",
      message: "Workout has no prescribed segments",
    };
  }

  const derived = normalizeActivityLapsFromDetail(activity.detailData);
  if (derived.length === 0) {
    await recordAlignmentFailure({
      activityId: params.activityId,
      workout,
      lapCount: 0,
      segmentCount: workout.segments.length,
    });
    return {
      ok: false,
      status: "NO_LAPS",
      lapCount: 0,
      segmentCount: workout.segments.length,
      message: "Activity detail has no usable laps",
    };
  }

  const baseSegments: BaseSeg[] = workout.segments.map((s) => ({
    id: s.id,
    stepOrder: s.stepOrder,
    title: s.title,
    durationType: s.durationType,
    durationValue: s.durationValue,
    repeatCount: s.repeatCount,
    targets: s.targets,
    paceTargetEncodingVersion: s.paceTargetEncodingVersion,
  }));

  const assignment = assignLapsToSegments(
    derived,
    baseSegments,
    workout.workoutType
  );

  if (!assignment) {
    await recordAlignmentFailure({
      activityId: params.activityId,
      workout,
      lapCount: derived.length,
      segmentCount: workout.segments.length,
    });
    console.warn(
      `[activityToSegment] alignment_failed activity=${params.activityId} workout=${workout.id} type=${workout.workoutType} laps=${derived.length} segments=${workout.segments.length}`
    );
    return {
      ok: false,
      status: "ALIGNMENT_FAILED",
      lapCount: derived.length,
      segmentCount: workout.segments.length,
      message: `Activity laps (${derived.length}) did not match planned steps (${workout.segments.length})`,
    };
  }

  await mutateSegmentExecution({
    activityId: params.activityId,
    workout: {
      id: workout.id,
      workoutType: workout.workoutType,
      segments: baseSegments,
    },
    derived,
    assignment,
  });

  console.log(
    `[activityToSegment] aligned activity=${params.activityId} workout=${workout.id} mode=${assignment.mode} laps=${derived.length}`
  );

  return {
    ok: true,
    status: "ALIGNED",
    mode: assignment.mode,
    lapCount: derived.length,
    segmentCount: workout.segments.length,
  };
}

/** Resolve workout from matched activity and parse segment execution. */
export async function parseMatchedActivityToSegmentExecution(
  activityId: string
): Promise<SegmentExecutionResult> {
  return parseActivityToSegmentExecution({ activityId });
}
