/**
 * Goal race pace from finish time + distance. Used to imprint race pace on plans
 * and for mpSimulation catalogue segments.
 */

import {
  distanceMilesToPaceRaceKey,
  parsePaceToSecondsPerMile,
  parseRaceTimeToSeconds,
  raceTimeToGoalPaceSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";

/** Pace anchor: fitness (5K-derived) vs goal race pace from plan goal time. */
export const PACE_ANCHOR_CURRENT_BUILDUP = "currentBuildup";
export const PACE_ANCHOR_MP_SIMULATION = "mpSimulation";

export type PaceAnchorMode =
  | typeof PACE_ANCHOR_CURRENT_BUILDUP
  | typeof PACE_ANCHOR_MP_SIMULATION;

export function normalizePaceAnchor(raw: string | null | undefined): PaceAnchorMode {
  const s = (raw ?? "").trim();
  if (s === PACE_ANCHOR_MP_SIMULATION) return PACE_ANCHOR_MP_SIMULATION;
  return PACE_ANCHOR_CURRENT_BUILDUP;
}

export function isMpSimulationAnchor(mode: string | null | undefined): boolean {
  return normalizePaceAnchor(mode) === PACE_ANCHOR_MP_SIMULATION;
}

/** Seconds per mile from goal finish time string (e.g. "2:59:00") and race distance in miles. */
export function goalPaceSecondsPerMileFromPlan(
  goalRaceTime: string | null | undefined,
  raceDistanceMiles: number
): number | null {
  const t = goalRaceTime?.trim();
  if (!t) return null;
  const key = distanceMilesToPaceRaceKey(raceDistanceMiles);
  try {
    const sec = parseRaceTimeToSeconds(t);
    return raceTimeToGoalPaceSecondsPerMile(sec, key);
  } catch {
    return null;
  }
}

/** "6:52" from seconds per mile (no /mi suffix — callers add label). */
export function formatPaceMinSec(secondsPerMile: number): string {
  const s = Math.max(1, Math.round(secondsPerMile));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Derive imprint string for training_plans.goalRacePace */
export function goalRacePaceDisplayString(
  goalRaceTime: string | null | undefined,
  raceDistanceMiles: number
): string | null {
  const spm = goalPaceSecondsPerMileFromPlan(goalRaceTime, raceDistanceMiles);
  if (spm == null) return null;
  return formatPaceMinSec(spm);
}

/** Rough bounds for per-mile goal pace (3:00–15:00 /mi). Rejects finish-time strings like "57:37". */
const MIN_PLAUSIBLE_GOAL_PACE_SEC_PER_MILE = 180;
const MAX_PLAUSIBLE_GOAL_PACE_SEC_PER_MILE = 900;

export function isPlausibleGoalPaceSecPerMile(secPerMile: number): boolean {
  return (
    Number.isFinite(secPerMile) &&
    secPerMile >= MIN_PLAUSIBLE_GOAL_PACE_SEC_PER_MILE &&
    secPerMile <= MAX_PLAUSIBLE_GOAL_PACE_SEC_PER_MILE
  );
}

/** Prefer imprinted goalRacePace when plausible; else derive from goal time + race distance. */
export function resolveRacePaceSecondsPerMileForPlan(params: {
  goalRacePace: string | null | undefined;
  goalRaceTime: string | null | undefined;
  raceDistanceMiles: number | null | undefined;
}): number | null {
  const miles = params.raceDistanceMiles;
  const derived =
    miles != null && Number.isFinite(miles) && miles > 0
      ? goalPaceSecondsPerMileFromPlan(params.goalRaceTime, miles)
      : null;

  const paceStr = params.goalRacePace?.trim();
  if (paceStr) {
    try {
      const parsed = parsePaceToSecondsPerMile(paceStr);
      if (isPlausibleGoalPaceSecPerMile(parsed)) {
        if (derived != null) {
          const ratio = parsed / derived;
          if (ratio >= 0.5 && ratio <= 2) return parsed;
        } else {
          return parsed;
        }
      }
    } catch {
      /* fall through to derived */
    }
  }

  return derived;
}
