/**
 * Beat-by-X → nudge-Y table for Where you stand (5K + threshold).
 * Single source of truth — do not duplicate MAX_ADJUST_SEC elsewhere.
 */

import { EASY_LONG_RUN_MAX_FAST_DRIFT_SEC_PER_MILE } from "@/lib/training/apply-activity-to-workout";

export const ADAPTIVE_PERFORMANCE_CONFIG = {
  /** Seconds faster than target → nudge sec/mi bands (positive beat = faster). */
  paceNudgeBands: [
    { minBeatSec: 15, nudgeSecPerMile: 12 },
    { minBeatSec: 10, nudgeSecPerMile: 10 },
    { minBeatSec: 5, nudgeSecPerMile: 8 },
    { minBeatSec: 0, nudgeSecPerMile: 5 },
  ] as const,
  /** Max sec/mi slower than target before we skip a faster nudge. */
  maxSlowSecBeforeNoNudge: 0,
  heldPaceMaxFastDriftSecPerMile: EASY_LONG_RUN_MAX_FAST_DRIFT_SEC_PER_MILE,
  /** Long-run durability: max sec/mi slower than target and still "held pace". */
  heldPaceMaxSlowSecPerMile: 30,
  minLongRunCapabilityMiles: 10,
  minThresholdAboveFiveKSec: 10,
  longRunDistanceRatio: 0.9,
} as const;

/**
 * Positive beatSec = actual faster than target (paceDeltaSecPerMile > 0 in our schema).
 * Returns nudge sec/mi to subtract from current anchor, or 0 if no faster nudge.
 */
export function nudgeSecPerMileFromBeat(beatSec: number | null | undefined): number {
  if (beatSec == null || !Number.isFinite(beatSec)) return 0;
  if (beatSec < ADAPTIVE_PERFORMANCE_CONFIG.maxSlowSecBeforeNoNudge) return 0;
  for (const band of ADAPTIVE_PERFORMANCE_CONFIG.paceNudgeBands) {
    if (beatSec >= band.minBeatSec) return band.nudgeSecPerMile;
  }
  return 0;
}

export function proposedPaceSecPerMile(params: {
  currentSecPerMile: number | null;
  beatSec: number | null | undefined;
}): number | null {
  const { currentSecPerMile, beatSec } = params;
  if (currentSecPerMile == null || !Number.isFinite(currentSecPerMile)) return null;
  const nudge = nudgeSecPerMileFromBeat(beatSec);
  if (nudge <= 0) return null;
  return Math.max(180, Math.round(currentSecPerMile - nudge));
}
