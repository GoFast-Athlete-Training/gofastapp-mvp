/**
 * Prescription helpers for Pace for Pace.
 *
 * Canon: every workout is prescribed. UI and status must not gate on eligibility.
 * `requiresSegmentLevelPaceForPace` is internal only — when lap/segment bolt is required
 * before segment comparison (Intervals/Tempo, multi-block long runs).
 */

import {
  normalizePaceTargetEncodingVersion,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import { isWorkSegmentTitle } from "./workout-performance-analysis";
import { requiresDetailForTargetAnalysis } from "./structured-workout-types";

type SegmentTarget = { type?: string; valueLow?: number; valueHigh?: number; value?: number };

export type PacedSegmentInput = {
  title: string;
  targets: unknown;
  paceTargetEncodingVersion: number;
};

export function paceTargetSecPerMileFromSegment(
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

/** Workout has at least one work-titled segment with a PACE target. */
export function workoutHasPacedWorkSegments(segments: PacedSegmentInput[]): boolean {
  return segments.some(
    (seg) =>
      isWorkSegmentTitle(seg.title) &&
      paceTargetSecPerMileFromSegment(seg.targets, seg.paceTargetEncodingVersion) != null
  );
}

/**
 * Internal: segment bolt / lap alignment required before rep-level comparison is trustworthy.
 * Single-block prescriptions (one Easy / Long Run segment) use whole-run comparison instead.
 */
export function requiresSegmentLevelPaceForPace(
  workoutType: string,
  segments: PacedSegmentInput[]
): boolean {
  if (requiresDetailForTargetAnalysis(workoutType)) return true;
  const pacedWorkSegments = segments.filter(
    (seg) =>
      isWorkSegmentTitle(seg.title) &&
      paceTargetSecPerMileFromSegment(seg.targets, seg.paceTargetEncodingVersion) != null
  );
  return pacedWorkSegments.length > 1;
}

/** Canon: every workout is prescribed — never gate Pace for Pace surfaces on this. */
export function requiresPaceForPaceAnalysis(
  _workoutType?: string,
  _segments?: PacedSegmentInput[]
): boolean {
  return true;
}
