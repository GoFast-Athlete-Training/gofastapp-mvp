/**
 * Pure pace math for goals — safe to import from client components.
 * Server goal persistence uses the same helpers via goal-service.
 */

import {
  RACE_DISTANCES_MILES,
  distanceMilesToPaceRaceKey,
  parseRaceTimeToSeconds,
  raceTimeToGoalPaceSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";

export const METERS_PER_MILE = 1609.344;

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

const MILES_5K = RACE_DISTANCES_MILES["5k"];

/** Normalize stored distance string to pace-calculator key */
export function normalizeDistanceForPace(
  distance: string,
  distanceMiles?: number | null
): string {
  const d = distance.toLowerCase().trim().replace(/\s+/g, "");
  if (d === "halfmarathon" || d === "half") return "half";
  if (d === "10k" || d === "10km") return "10k";
  if (d === "5k" || d === "5km") return "5k";
  if (d === "marathon" || d === "full" || d === "mara") return "marathon";
  if (d === "mile" || d === "1mile" || d === "1mi") return "mile";
  if (d === "ultra") {
    return "ultra";
  }
  if (RACE_DISTANCES_MILES[distance.toLowerCase().trim()]) {
    return distance.toLowerCase().trim();
  }
  if (distanceMiles != null) {
    return distanceMilesToPaceRaceKey(distanceMiles);
  }
  return "5k";
}

/**
 * Riegel-style equivalent 5K time at same fitness, then average pace (sec/mile) for 5K.
 */
export function equivalent5KPaceSecondsPerMile(
  raceTimeSeconds: number,
  eventMiles: number
): number {
  const t5kSec = raceTimeSeconds * Math.pow(MILES_5K / eventMiles, 1.06);
  return Math.max(1, Math.round(t5kSec / MILES_5K));
}

export function deriveGoalPaces(params: {
  distance: string;
  goalTime: string | null | undefined;
  distanceMiles?: number | null;
}): { goalRacePace: number | null; goalPace5K: number | null } {
  if (!params.goalTime?.trim()) {
    return { goalRacePace: null, goalPace5K: null };
  }

  const paceKey = normalizeDistanceForPace(params.distance, params.distanceMiles);
  const totalSeconds = parseRaceTimeToSeconds(params.goalTime.trim());

  let goalRacePace: number;
  let eventMiles: number;

  if (RACE_DISTANCES_MILES[paceKey] != null) {
    eventMiles = RACE_DISTANCES_MILES[paceKey];
    goalRacePace = raceTimeToGoalPaceSecondsPerMile(totalSeconds, paceKey);
  } else if (params.distanceMiles != null && params.distanceMiles > 0) {
    eventMiles = params.distanceMiles;
    goalRacePace = Math.round(totalSeconds / params.distanceMiles);
  } else {
    throw new Error(
      `Cannot derive pace for distance "${params.distance}" without distanceMiles`
    );
  }

  const goalPace5K =
    paceKey === "5k" ? goalRacePace : equivalent5KPaceSecondsPerMile(totalSeconds, eventMiles);

  return { goalRacePace, goalPace5K };
}
