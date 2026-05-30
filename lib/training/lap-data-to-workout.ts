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
