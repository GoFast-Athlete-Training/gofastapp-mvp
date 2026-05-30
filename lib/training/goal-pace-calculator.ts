/**
 * Goal race pace from finish time + distance. Used to imprint race pace on plans
 * and for mpSimulation catalogue segments.
 */

import {
  RACE_DISTANCES_MILES,
  distanceMilesToPaceRaceKey,
  parsePaceToSecondsPerMile,
  parseRaceTimeToSeconds,
  raceTimeToGoalPaceSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import { metersToMiles, normalizeDistanceForPace } from "@/lib/pace-utils";

/** Pace anchor: fitness (5K-derived) vs goal race pace from plan goal time. */
export const PACE_ANCHOR_CURRENT_BUILDUP = "currentBuildup";
export const PACE_ANCHOR_MP_SIMULATION = "mpSimulation";

export type PaceAnchorMode =
  | typeof PACE_ANCHOR_CURRENT_BUILDUP
  | typeof PACE_ANCHOR_MP_SIMULATION;

export type GoalPaceResolutionSource =
  | "db_goal_pace"
  | "plan_cache_pace"
  | "derived_from_goal_time"
  | null;

export type ResolvedGoalRacePace = {
  goalPaceSecPerMile: number | null;
  goalPaceDisplay: string | null;
  raceDistanceMiles: number | null;
  source: GoalPaceResolutionSource;
};

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

function agreesWithDerived(candidate: number, derived: number | null): boolean {
  if (derived == null) return true;
  const ratio = candidate / derived;
  return ratio >= 0.5 && ratio <= 2;
}

/** Normalize race distance in miles from registry meters, label, or goal distance key. */
export function resolveRaceDistanceMiles(params: {
  distanceMeters?: number | null;
  distanceLabel?: string | null;
  goalDistance?: string | null;
}): number | null {
  if (
    params.distanceMeters != null &&
    Number.isFinite(Number(params.distanceMeters)) &&
    Number(params.distanceMeters) > 0
  ) {
    const miles = metersToMiles(Number(params.distanceMeters));
    return miles > 0 ? miles : null;
  }

  const goalDistance = params.goalDistance?.trim();
  if (goalDistance) {
    const paceKey = normalizeDistanceForPace(
      goalDistance,
      null
    );
    const known = RACE_DISTANCES_MILES[paceKey];
    if (known != null && known > 0) return known;
  }

  const label = params.distanceLabel?.trim();
  if (label) {
    const paceKey = normalizeDistanceForPace(label, null);
    const known = RACE_DISTANCES_MILES[paceKey];
    if (known != null && known > 0) return known;
  }

  return null;
}

/**
 * Canonical goal race pace resolver — prefer DB goal pace, then plan cache, then derive
 * from goal time + linked race distance.
 */
export function resolveGoalRacePace(params: {
  goalTime?: string | null;
  dbGoalRacePaceSecPerMile?: number | null;
  planGoalRacePace?: string | null;
  distanceMeters?: number | null;
  distanceLabel?: string | null;
  goalDistance?: string | null;
}): ResolvedGoalRacePace {
  const raceDistanceMiles = resolveRaceDistanceMiles({
    distanceMeters: params.distanceMeters,
    distanceLabel: params.distanceLabel,
    goalDistance: params.goalDistance,
  });

  const goalTime = params.goalTime?.trim() || null;
  const derived =
    raceDistanceMiles != null && goalTime
      ? goalPaceSecondsPerMileFromPlan(goalTime, raceDistanceMiles)
      : null;

  const dbPace = params.dbGoalRacePaceSecPerMile;
  if (
    dbPace != null &&
    isPlausibleGoalPaceSecPerMile(dbPace) &&
    agreesWithDerived(dbPace, derived)
  ) {
    return {
      goalPaceSecPerMile: dbPace,
      goalPaceDisplay: formatPaceMinSec(dbPace),
      raceDistanceMiles,
      source: "db_goal_pace",
    };
  }

  const planStr = params.planGoalRacePace?.trim();
  if (planStr) {
    try {
      const parsed = parsePaceToSecondsPerMile(planStr);
      if (
        isPlausibleGoalPaceSecPerMile(parsed) &&
        agreesWithDerived(parsed, derived)
      ) {
        return {
          goalPaceSecPerMile: parsed,
          goalPaceDisplay: formatPaceMinSec(parsed),
          raceDistanceMiles,
          source: "plan_cache_pace",
        };
      }
    } catch {
      /* fall through */
    }
  }

  if (derived != null && isPlausibleGoalPaceSecPerMile(derived)) {
    return {
      goalPaceSecPerMile: derived,
      goalPaceDisplay: formatPaceMinSec(derived),
      raceDistanceMiles,
      source: "derived_from_goal_time",
    };
  }

  return {
    goalPaceSecPerMile: null,
    goalPaceDisplay: null,
    raceDistanceMiles,
    source: null,
  };
}

/** Prefer imprinted goalRacePace when plausible; else derive from goal time + race distance. */
export function resolveRacePaceSecondsPerMileForPlan(params: {
  goalRacePace?: string | null;
  goalRaceTime?: string | null;
  raceDistanceMiles?: number | null;
  dbGoalRacePaceSecPerMile?: number | null;
  distanceLabel?: string | null;
  goalDistance?: string | null;
}): number | null {
  const resolved = resolveGoalRacePace({
    goalTime: params.goalRaceTime,
    dbGoalRacePaceSecPerMile: params.dbGoalRacePaceSecPerMile,
    planGoalRacePace: params.goalRacePace,
    distanceMeters:
      params.raceDistanceMiles != null && params.raceDistanceMiles > 0
        ? params.raceDistanceMiles * 1609.344
        : null,
    distanceLabel: params.distanceLabel,
    goalDistance: params.goalDistance,
  });
  return resolved.goalPaceSecPerMile;
}
