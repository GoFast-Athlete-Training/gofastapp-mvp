/**
 * Map derived Garmin laps to workout segment rows, persist workout_segment_laps,
 * and refresh segment + workout-level aggregates.
 *
 * Structured workouts (Intervals/Tempo): lap[i] → segment row i only when counts match.
 * Easy/LongRun: mile-chunk auto alignment when lap count matches prescription totals.
 *
 * @deprecated Prefer parseActivityToSegmentExecution() for the activity-to-segment pipeline.
 */

import { Prisma } from "@prisma/client";
import type { DerivedLap } from "./lap-converter";
import { parseActivityToSegmentExecution } from "./activity-to-segment-execution";
import { requiresDetailForTargetAnalysis } from "./structured-workout-types";

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

export type LapAssignmentMode = "step" | "auto" | "distance" | "unassigned";

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

function prescribedDistanceMiles(seg: BaseSeg): number {
  const dt = String(seg.durationType).toUpperCase();
  if (dt !== "DISTANCE") return 0;
  return seg.durationValue * Math.max(1, seg.repeatCount ?? 1);
}

/**
 * Walk segments in order; consume consecutive laps by cumulative distance.
 * Accepts early-advance short laps (e.g. 0.7 mi of a 1.5 mi warmup).
 */
function assignByDistanceConsumption(
  derived: DerivedLap[],
  baseSegments: BaseSeg[]
): LapAssignment | null {
  const sorted = [...baseSegments].sort((a, b) => a.stepOrder - b.stepOrder);
  if (sorted.length === 0) return null;

  const bySeg = emptyBySegment(baseSegments);
  let lapIdx = 0;

  for (let segIdx = 0; segIdx < sorted.length; segIdx++) {
    const seg = sorted[segIdx]!;
    const dt = String(seg.durationType).toUpperCase();

    if (lapIdx >= derived.length) break;

    if (dt === "TIME") {
      bySeg.get(seg.id)!.push(derived[lapIdx]!);
      lapIdx++;
      continue;
    }

    if (dt !== "DISTANCE") continue;

    const targetMiles = prescribedDistanceMiles(seg);
    if (targetMiles <= 0) continue;

    let totalMiles = 0;
    const chunk: DerivedLap[] = [];

    while (lapIdx < derived.length) {
      const lap = derived[lapIdx]!;
      chunk.push(lap);
      lapIdx++;
      if (lap.distanceMiles != null && lap.distanceMiles > 0) {
        totalMiles += lap.distanceMiles;
      }

      const earlyAdvanceShortLap =
        chunk.length === 1 &&
        totalMiles > 0 &&
        totalMiles < targetMiles * 0.95;

      if (earlyAdvanceShortLap) break;

      if (totalMiles >= targetMiles * 0.85) break;

      const maxLapsForSegment = expectedAutoLapCountForSegment(seg);
      if (maxLapsForSegment > 0 && chunk.length >= maxLapsForSegment) break;
    }

    if (chunk.length === 0) return null;
    for (const d of chunk) {
      bySeg.get(seg.id)!.push(d);
    }
  }

  // Remaining laps attach to the final segment (over-distance on last step).
  if (lapIdx < derived.length) {
    const lastSeg = sorted[sorted.length - 1]!;
    while (lapIdx < derived.length) {
      bySeg.get(lastSeg.id)!.push(derived[lapIdx]!);
      lapIdx++;
    }
  }

  const assignedCount = [...bySeg.values()].reduce((a, ls) => a + ls.length, 0);
  if (assignedCount === 0) return null;

  return { mode: "distance", bySegment: bySeg };
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
    const structured = assignStructuredLaps(derived, baseSegments);
    if (structured) return structured;
    return assignByDistanceConsumption(derived, baseSegments);
  }

  const auto = assignContinuousRunLaps(derived, baseSegments);
  if (auto) return auto;

  const distance = assignByDistanceConsumption(derived, baseSegments);
  if (distance) return distance;

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

/**
 * After ACTIVITY_DETAIL: persist derived laps + segment / workout updates.
 * Delegates to parseActivityToSegmentExecution when a workout is matched.
 */
export async function writeLapsToWorkout(
  athleteActivityId: string,
  derived: DerivedLap[]
): Promise<void> {
  if (derived.length === 0) return;
  await parseActivityToSegmentExecution({ activityId: athleteActivityId });
}
