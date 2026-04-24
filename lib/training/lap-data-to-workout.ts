/**
 * Map derived Garmin laps to workout segment rows, persist workout_segment_laps,
 * and refresh segment + workout-level aggregates.
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  normalizePaceTargetEncodingVersion,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import type { DerivedLap } from "./lap-converter";

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

type Slot = {
  segmentId: string;
  targets: Prisma.JsonValue;
  paceTargetEncodingVersion: number;
};

function expandSegmentSlots(
  segments: {
    id: string;
    stepOrder: number;
    targets: Prisma.JsonValue;
    title: string;
    repeatCount?: number | null;
    paceTargetEncodingVersion: number;
  }[]
): Slot[] {
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  const slots: Slot[] = [];
  for (const seg of sorted) {
    const r = Math.max(1, seg.repeatCount ?? 1);
    for (let k = 0; k < r; k++) {
      slots.push({
        segmentId: seg.id,
        targets: seg.targets,
        paceTargetEncodingVersion: seg.paceTargetEncodingVersion,
      });
    }
  }
  return slots;
}

type BaseSeg = {
  id: string;
  stepOrder: number;
  durationType: string;
  durationValue: number;
  repeatCount: number | null;
  targets: Prisma.JsonValue;
  paceTargetEncodingVersion: number;
};

function expectedAutoLapCountForSegment(seg: BaseSeg): number {
  if (String(seg.durationType).toUpperCase() !== "DISTANCE") return 0;
  const miles = seg.durationValue * Math.max(1, seg.repeatCount ?? 1);
  return Math.max(1, Math.round(miles));
}

type Assignment = {
  mode: "step" | "auto" | "fallback";
  /**
   * For each (segmentId), ordered list of derived laps in that segment.
   */
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

function assignLaps(
  derived: DerivedLap[],
  slots: Slot[],
  baseSegments: BaseSeg[]
): Assignment {
  // Step: 1:1 with repeat-expanded slot rows
  if (derived.length === slots.length && slots.length > 0) {
    const bySeg = emptyBySegment(baseSegments);
    for (let i = 0; i < derived.length; i++) {
      const segId = slots[i]!.segmentId;
      bySeg.get(segId)!.push(derived[i]!);
    }
    return { mode: "step", bySegment: bySeg };
  }

  // Auto: sum of per-segment (rounded) mile-lap counts must equal # of
  // Garmin laps; then take consecutive chunk per segment.
  const sorted = [...baseSegments].sort((a, b) => a.stepOrder - b.stepOrder);
  const totalNeed = sorted.reduce(
    (a, s) => a + expectedAutoLapCountForSegment(s),
    0
  );
  if (totalNeed > 0 && totalNeed === derived.length) {
    const byAuto = emptyBySegment(baseSegments);
    let idx = 0;
    for (const seg of sorted) {
      const need = expectedAutoLapCountForSegment(seg);
      if (need === 0) continue;
      const chunk = derived.slice(idx, idx + need);
      if (chunk.length !== need) {
        break;
      }
      idx += need;
      for (const d of chunk) {
        byAuto.get(seg.id)!.push(d);
      }
    }
    if (idx === derived.length) {
      return { mode: "auto", bySegment: byAuto };
    }
  }

  // Fallback: all derived laps to first segment
  const first = sorted[0];
  if (first) {
    const m = emptyBySegment(baseSegments);
    m.set(first.id, [...derived]);
    console.warn(
      `[lapDataToWorkout] fallback: ${derived.length} laps → first segment ${first.id}`
    );
    return { mode: "fallback", bySegment: m };
  }
  return { mode: "fallback", bySegment: emptyBySegment(baseSegments) };
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
    durationType: s.durationType,
    durationValue: s.durationValue,
    repeatCount: s.repeatCount,
    targets: s.targets,
    paceTargetEncodingVersion: s.paceTargetEncodingVersion,
  }));
  const slots = expandSegmentSlots(workout.segments);
  const { mode, bySegment } = assignLaps(derived, slots, baseSegments);

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
    await tx.workout_segment_laps.deleteMany({
      where: { segment: { workoutId: workout.id } },
    });
    if (toCreate.length > 0) {
      await tx.workout_segment_laps.createMany({ data: toCreate });
    }

    for (const seg of workout.segments) {
      const ls = bySegment.get(seg.id) ?? [];
      if (ls.length === 0) {
        await tx.workout_segments.update({
          where: { id: seg.id },
          data: {
            actualPaceSecPerMile: null,
            actualDistanceMiles: null,
            actualDurationSeconds: null,
            updatedAt: new Date(),
          },
        });
        continue;
      }
      const agg = recomputeSegmentAggregates(ls);
      await tx.workout_segments.update({
        where: { id: seg.id },
        data: {
          ...agg,
          updatedAt: new Date(),
        },
      });
    }

    // Workout-level pace delta (evaluationEligible)
    const deltas: number[] = [];
    if (mode === "step") {
      for (let i = 0; i < slots.length; i++) {
        const target = paceTargetSecPerMileFromTargets(
          slots[i]!.targets,
          slots[i]!.paceTargetEncodingVersion
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
        },
      });
    }
  });

  console.log(
    `[lapDataToWorkout] activity=${athleteActivityId} workout=${workout.id} mode=${mode} derived=${derived.length}`
  );
}
