/**
 * Phase-2 evaluation: use ACTIVITY_DETAIL laps + samples vs workout segments (repeat-expanded).
 * Writes per-segment actual pace/distance/duration when lap count matches expanded slots.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  normalizePaceTargetEncodingVersion,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";

type Lap = { startTimeInSeconds?: number };
type Sample = {
  startTimeInSeconds?: number;
  speedMetersPerSecond?: number;
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

function expandSegmentSlotsWithIds(
  segments: {
    id: string;
    stepOrder: number;
    targets: Prisma.JsonValue;
    title: string;
    repeatCount?: number | null;
    paceTargetEncodingVersion: number;
  }[]
) {
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  const slots: {
    segmentId: string;
    targets: Prisma.JsonValue;
    title: string;
    paceTargetEncodingVersion: number;
  }[] = [];
  for (const seg of sorted) {
    const r = Math.max(1, seg.repeatCount ?? 1);
    for (let k = 0; k < r; k++) {
      slots.push({
        segmentId: seg.id,
        targets: seg.targets,
        title: seg.title,
        paceTargetEncodingVersion: seg.paceTargetEncodingVersion,
      });
    }
  }
  return slots;
}

function avgSpeedInWindow(
  samples: Sample[],
  tStart: number,
  tEnd: number
): number | null {
  const inWin = samples.filter(
    (s) =>
      s.startTimeInSeconds != null &&
      s.startTimeInSeconds >= tStart &&
      s.startTimeInSeconds < tEnd &&
      s.speedMetersPerSecond != null &&
      s.speedMetersPerSecond > 0
  );
  if (inWin.length === 0) return null;
  const sum = inWin.reduce((a, s) => a + (s.speedMetersPerSecond as number), 0);
  return sum / inWin.length;
}

type Agg = {
  totalDur: number;
  totalDistMiles: number;
  paceWeightedSum: number;
  paceWeight: number;
};

/**
 * After detailData is hydrated, refine workout evaluation if laps align with segment slots.
 */
export async function evaluateLapSegmentsAfterDetail(
  athleteActivityId: string
): Promise<void> {
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: athleteActivityId },
  });
  if (!activity?.detailData) return;

  const workout = await prisma.workouts.findFirst({
    where: { matchedActivityId: athleteActivityId },
    include: { segments: { orderBy: { stepOrder: "asc" } } },
  });
  if (!workout?.segments?.length) return;

  const detail = activity.detailData as Record<string, unknown>;
  const laps = (detail.laps ?? detail.Laps) as Lap[] | undefined;
  const samples = (detail.samples ?? detail.Samples) as Sample[] | undefined;
  if (!Array.isArray(laps) || !Array.isArray(samples) || laps.length < 2) {
    return;
  }

  const slots = expandSegmentSlotsWithIds(workout.segments);
  if (laps.length !== slots.length) {
    console.warn(
      `[evaluateLapSegments] lap count ${laps.length} !== expected slots ${slots.length} for activity ${athleteActivityId}`
    );
    return;
  }

  const sortedSamples = [...samples].sort(
    (a, b) => (a.startTimeInSeconds ?? 0) - (b.startTimeInSeconds ?? 0)
  );

  const lapStarts = laps
    .map((l) => l.startTimeInSeconds)
    .filter((t): t is number => t != null && Number.isFinite(t));
  if (lapStarts.length !== laps.length) return;

  const deltas: number[] = [];
  const bySeg = new Map<string, Agg>();

  const lastLapStart = lapStarts[lapStarts.length - 1];
  const lastSampleT =
    sortedSamples.length > 0
      ? (sortedSamples[sortedSamples.length - 1].startTimeInSeconds ?? lastLapStart) + 2
      : lastLapStart + 3600;

  for (let i = 0; i < slots.length; i++) {
    const t0 = lapStarts[i];
    const t1 = i + 1 < lapStarts.length ? lapStarts[i + 1] : lastSampleT;
    const dur = Math.max(0, t1 - t0);
    const target = paceTargetSecPerMileFromTargets(
      slots[i].targets,
      slots[i].paceTargetEncodingVersion
    );

    const avgMps = avgSpeedInWindow(sortedSamples, t0, t1);
    const segmentId = slots[i].segmentId;
    let agg = bySeg.get(segmentId);
    if (!agg) {
      agg = { totalDur: 0, totalDistMiles: 0, paceWeightedSum: 0, paceWeight: 0 };
      bySeg.set(segmentId, agg);
    }
    agg.totalDur += dur;
    if (avgMps != null && avgMps > 0 && dur > 0) {
      agg.totalDistMiles += (avgMps * dur) / 1609.34;
      const actualSecPerMile = Math.round(1609.34 / avgMps);
      agg.paceWeightedSum += actualSecPerMile * dur;
      agg.paceWeight += dur;
    }

    if (target == null || avgMps == null || avgMps <= 0) continue;

    const actualSecPerMileRow = Math.round(1609.34 / avgMps);
    deltas.push(target - actualSecPerMileRow);
  }

  for (const [segmentId, agg] of bySeg) {
    if (agg.totalDur <= 0 && agg.paceWeight <= 0 && agg.totalDistMiles <= 0) {
      continue;
    }
    const data: Prisma.workout_segmentsUpdateInput = { updatedAt: new Date() };
    if (agg.totalDur > 0) {
      data.actualDurationSeconds = Math.round(agg.totalDur);
    }
    if (agg.totalDistMiles > 0) {
      data.actualDistanceMiles = Math.round(agg.totalDistMiles * 100) / 100;
    }
    if (agg.paceWeight > 0) {
      data.actualPaceSecPerMile = Math.round(
        agg.paceWeightedSum / agg.paceWeight
      );
    }
    await prisma.workout_segments.update({
      where: { id: segmentId },
      data,
    });
  }

  if (deltas.length === 0) return;

  const avgDelta = Math.round(
    deltas.reduce((a, b) => a + b, 0) / deltas.length
  );

  await prisma.workouts.update({
    where: { id: workout.id },
    data: {
      paceDeltaSecPerMile: avgDelta,
      evaluationEligibleFlag: true,
    },
  });
}
