/**
 * Map derived Garmin laps to workout segment rows, persist workout_segment_laps,
 * and refresh segment + workout-level aggregates.
 *
 * Walk segments by stepOrder and consume laps in order. repeatCount on a row
 * means that many consecutive laps (e.g. 400×8 → eight 400m laps on one segment).
 *
 * @deprecated Prefer parseActivityToSegmentExecution() for the activity-to-segment pipeline.
 */

import { Prisma } from "@prisma/client";
import type { DerivedLap } from "./lap-converter";
import { parseActivityToSegmentExecution } from "./activity-to-segment-execution";

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

export type LapAssignmentMode = "step" | "distance" | "unassigned";

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

/** One Garmin lap per materialized segment row when counts happen to match. */
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

function prescribedDistanceMiles(seg: BaseSeg): number {
  const dt = String(seg.durationType).toUpperCase();
  if (dt !== "DISTANCE") return 0;
  return seg.durationValue * Math.max(1, seg.repeatCount ?? 1);
}

/** repeatCount > 1 distance row → one Garmin lap per rep (400m or mile repeats). */
function isRepeatedRepSegment(seg: BaseSeg): boolean {
  const reps = Math.max(1, seg.repeatCount ?? 1);
  if (reps <= 1) return false;
  return String(seg.durationType).toUpperCase() === "DISTANCE";
}

/** Max mile-boundary laps for a continuous (non-rep-block) distance segment. */
function maxMileBoundaryLapsForSegment(seg: BaseSeg): number {
  const dt = String(seg.durationType).toUpperCase();
  if (dt === "TIME") return 1;
  if (dt !== "DISTANCE") return 0;

  const miles = prescribedDistanceMiles(seg);
  if (!Number.isFinite(miles) || miles <= 0) return 0;
  if (miles < 0.9) return 1;
  if (isBookendTitle(seg.title)) {
    return Math.max(1, Math.round(miles));
  }
  return Math.max(1, Math.round(miles));
}

/**
 * Walk segments in stepOrder; consume consecutive laps until each step is filled.
 * repeatCount rows consume one lap per rep (Garmin exploded WorkoutRepeatStep).
 */
function assignByStepOrderConsumption(
  derived: DerivedLap[],
  baseSegments: BaseSeg[]
): LapAssignment | null {
  const sorted = [...baseSegments].sort((a, b) => a.stepOrder - b.stepOrder);
  if (sorted.length === 0) return null;

  const bySeg = emptyBySegment(baseSegments);
  let lapIdx = 0;

  for (const seg of sorted) {
    if (lapIdx >= derived.length) break;

    const dt = String(seg.durationType).toUpperCase();

    if (dt === "TIME") {
      bySeg.get(seg.id)!.push(derived[lapIdx]!);
      lapIdx++;
      continue;
    }

    if (isRepeatedRepSegment(seg)) {
      const reps = Math.max(1, seg.repeatCount ?? 1);
      for (let r = 0; r < reps; r++) {
        if (lapIdx >= derived.length) break;
        bySeg.get(seg.id)!.push(derived[lapIdx]!);
        lapIdx++;
      }
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
        isBookendTitle(seg.title) &&
        chunk.length === 1 &&
        totalMiles > 0 &&
        totalMiles < targetMiles * 0.95;

      if (earlyAdvanceShortLap) break;

      if (totalMiles >= targetMiles * 0.85) break;

      const maxLaps = maxMileBoundaryLapsForSegment(seg);
      if (maxLaps > 0 && chunk.length >= maxLaps) break;
    }

    if (chunk.length === 0) return null;
    for (const d of chunk) {
      bySeg.get(seg.id)!.push(d);
    }
  }

  const assignedCount = [...bySeg.values()].reduce((a, ls) => a + ls.length, 0);
  if (assignedCount === 0) return null;

  return { mode: "distance", bySegment: bySeg };
}

/**
 * Assign laps to segments. Returns null when alignment cannot be trusted.
 */
export function assignLapsToSegments(
  derived: DerivedLap[],
  baseSegments: BaseSeg[],
  _workoutType?: string
): LapAssignment | null {
  if (derived.length === 0 || baseSegments.length === 0) return null;

  const structured = assignStructuredLaps(derived, baseSegments);
  if (structured) return structured;

  return assignByStepOrderConsumption(derived, baseSegments);
}

/** @internal */
export function assignLapsForTest(
  derived: DerivedLap[],
  segments: BaseSeg[],
  workoutType?: string
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
