/**
 * Phase-2 evaluation: use ACTIVITY_DETAIL laps + samples vs workout segments (repeat-expanded).
 * Only refines derivedPerformanceDeltaSeconds when lap count matches expected slots.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Lap = { startTimeInSeconds?: number };
type Sample = {
  startTimeInSeconds?: number;
  speedMetersPerSecond?: number;
};

function paceTargetSecPerMileFromTargets(targets: unknown): number | null {
  if (!Array.isArray(targets) || targets.length === 0) return null;
  const t = targets[0] as { type?: string; valueLow?: number; value?: number };
  if (!t?.type || String(t.type).toUpperCase() !== "PACE") return null;
  const low = t.valueLow ?? t.value;
  if (low == null || typeof low !== "number" || low <= 0) return null;
  return Math.round(low * 1.60934);
}

function expandSegmentSlots(
  segments: {
    stepOrder: number;
    targets: Prisma.JsonValue;
    title: string;
    repeatCount?: number | null;
  }[]
) {
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  const slots: { targets: Prisma.JsonValue; title: string }[] = [];
  for (const seg of sorted) {
    const r = Math.max(1, seg.repeatCount ?? 1);
    for (let k = 0; k < r; k++) {
      slots.push({ targets: seg.targets, title: seg.title });
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

  const slots = expandSegmentSlots(workout.segments);
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

  const lastLapStart = lapStarts[lapStarts.length - 1];
  const lastSampleT =
    sortedSamples.length > 0
      ? (sortedSamples[sortedSamples.length - 1].startTimeInSeconds ?? lastLapStart) + 2
      : lastLapStart + 3600;

  for (let i = 0; i < slots.length; i++) {
    const t0 = lapStarts[i];
    const t1 =
      i + 1 < lapStarts.length ? lapStarts[i + 1] : lastSampleT;
    const target = paceTargetSecPerMileFromTargets(slots[i].targets);
    if (target == null) continue;

    const avgMps = avgSpeedInWindow(sortedSamples, t0, t1);
    if (avgMps == null || avgMps <= 0) continue;
    const actualSecPerMile = Math.round(1609.34 / avgMps);
    deltas.push(target - actualSecPerMile);
  }

  if (deltas.length === 0) return;

  const avgDelta = Math.round(
    deltas.reduce((a, b) => a + b, 0) / deltas.length
  );
  let direction: string;
  if (avgDelta > 5) direction = "positive";
  else if (avgDelta < -5) direction = "negative";
  else direction = "neutral";

  await prisma.workouts.update({
    where: { id: workout.id },
    data: {
      derivedPerformanceDeltaSeconds: avgDelta,
      derivedPerformanceDirection: direction,
      evaluationEligibleFlag: true,
    },
  });
}
