/**
 * Map derived Garmin laps to workout segment rows, persist workout_segment_laps,
 * and refresh segment + workout-level aggregates.
 *
 * Structured workouts (Intervals/Tempo): lap[i] → segment row i only when counts match.
 * Easy/LongRun: mile-chunk auto alignment when lap count matches prescription totals.
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  normalizePaceTargetEncodingVersion,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import type { DerivedLap } from "./lap-converter";
import { requiresDetailForTargetAnalysis } from "./structured-workout-types";

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

export type LapAssignmentMode = "step" | "auto" | "unassigned";

export type LapAssignment = {
  mode: LapAssignmentMode;
  bySegment: Map<string, DerivedLap[]>;
};

function emptyBySegment(
  baseSegments: BaseSeg[]
): Map<string, DerivedLap[]> {
  const m = new Map<string, DerivedLap[]>();
  for (const s of baseSegments) {
    m.set(s.id, []);
  }
  return m;
}

/** One Garmin lap per materialized segment row (stepOrder). */
function assignStructuredLaps(
  derived: DerivedLap[],
  baseSegments: BaseSeg[]
): LapAssignment | null {
  const sorted = [...baseSegments].sort((a, b) => a.stepOrder - b.stepOrder);
  if (derived.length !== sorted.length || sorted.length === 0) return null;

  const bySeg = emptyBySegment(baseSegments);
  for (let i = 0; i < derived.length; i++) {
    bySeg.get(sorted[i]!.id)!.push(derived[i]!);
  }
  return { mode: "step", bySegment: bySeg };
}

function isBookendTitle(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("warm") || t.includes("cool");
}

/** Expected auto-lap count per segment row (Easy/LongRun mile boundaries). */
function expectedAutoLapCountForSegment(seg: BaseSeg): number {
  const dt = String(seg.durationType).toUpperCase();
  if (dt === "TIME") return 1;
  if (dt !== "DISTANCE") return 0;

  const miles = seg.durationValue * Math.max(1, seg.repeatCount ?? 1);
  if (!Number.isFinite(miles) || miles <= 0) return 0;
  if (miles < 0.9) return 1;
  if (isBookendTitle(seg.title)) {
    return Math.max(1, Math.round(miles));
  }
  return Math.max(1, Math.round(miles));
}

/** Consecutive mile chunks per segment when total laps match prescription. */
function assignContinuousRunLaps(
  derived: DerivedLap[],
  baseSegments: BaseSeg[]
): LapAssignment | null {
  const sorted = [...baseSegments].sort((a, b) => a.stepOrder - b.stepOrder);
  const totalNeed = sorted.reduce(
    (a, s) => a + expectedAutoLapCountForSegment(s),
    0
  );
  if (totalNeed <= 0 || totalNeed !== derived.length) return null;

  const byAuto = emptyBySegment(baseSegments);
  let idx = 0;
  for (const seg of sorted) {
    const need = expectedAutoLapCountForSegment(seg);
    if (need === 0) continue;
    const chunk = derived.slice(idx, idx + need);
    if (chunk.length !== need) return null;
    idx += need;
    for (const d of chunk) {
      byAuto.get(seg.id)!.push(d);
    }
  }
  if (idx !== derived.length) return null;
  return { mode: "auto", bySegment: byAuto };
}

/**
 * Assign laps to segments. Returns null when alignment cannot be trusted
 * (structured: no guessing; continuous: no fallback dump to first segment).
 */
export function assignLapsToSegments(
  derived: DerivedLap[],
  baseSegments: BaseSeg[],
  workoutType: string
): LapAssignment | null {
  if (derived.length === 0 || baseSegments.length === 0) return null;

  if (requiresDetailForTargetAnalysis(workoutType)) {
    return assignStructuredLaps(derived, baseSegments);
  }

  const auto = assignContinuousRunLaps(derived, baseSegments);
  if (auto) return auto;

  return assignStructuredLaps(derived, baseSegments);
}

/** @internal */
export function assignLapsForTest(
  derived: DerivedLap[],
  segments: BaseSeg[],
  workoutType: string
): LapAssignment | null {
  return assignLapsToSegments(derived, segments, workoutType);
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

async function clearWorkoutLapExecution(
  tx: Prisma.TransactionClient,
  workout: { id: string; segments: { id: string }[] }
): Promise<void> {
  await tx.workout_segment_laps.deleteMany({
    where: { segment: { workoutId: workout.id } },
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
      updatedAt: new Date(),
    },
  });
}

/**
 * After ACTIVITY_DETAIL: persist derived laps + segment / workout updates.
 */
export async function writeLapsToWorkout(
  athleteActivityId: string,
  derived: DerivedLap[]
): Promise<void> {
  if (derived.length === 0) return;

  const activity = await prisma.athlete_activities.findUnique({
    where: { id: athleteActivityId },
  });
  if (!activity) return;

  const workout = await prisma.workouts.findFirst({
    where: { matchedActivityId: athleteActivityId },
    include: { segments: { orderBy: { stepOrder: "asc" } } },
  });
  if (!workout?.segments?.length) return;

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
    await prisma.$transaction(async (tx) => {
      await clearWorkoutLapExecution(tx, workout);
    });
    console.warn(
      `[lapDataToWorkout] unassigned activity=${athleteActivityId} workout=${workout.id} type=${workout.workoutType} laps=${derived.length} segments=${workout.segments.length}`
    );
    return;
  }

  const { mode, bySegment } = assignment;
  const toCreate: Prisma.workout_segment_lapsCreateManyInput[] = [];
  for (const [segmentId, laps] of bySegment) {
    for (const d of laps) {
      toCreate.push({
        id: randomUUID(),
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
    await clearWorkoutLapExecution(tx, workout);

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
      for (const seg of baseSegments) {
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

    if (deltas.length > 0) {
      const avgDelta = Math.round(
        deltas.reduce((a, b) => a + b, 0) / deltas.length
      );
      await tx.workouts.update({
        where: { id: workout.id },
        data: {
          paceDeltaSecPerMile: avgDelta,
          evaluationEligibleFlag: true,
          updatedAt: new Date(),
        },
      });
    }
  });

  console.log(
    `[lapDataToWorkout] activity=${athleteActivityId} workout=${workout.id} mode=${mode} derived=${derived.length}`
  );
}
