/**
 * Conservative run-mile equivalents for cross-training volume (readiness copy only).
 * Does not affect `currentFiveKPace` or Garmin prescription.
 */

/** Per mile ridden (road / trainer), mapped to a small run-mile credit for aerobic load. */
export const RUN_MILES_PER_BIKE_MILE = 0.25;

/**
 * Per 100 m swum (pool or open water when distance is available on the activity).
 * ~0.1 run mi / 100 m is intentionally conservative vs many coaching heuristics.
 */
export const RUN_MILES_PER_100M_SWIM = 0.1;

export function bikeMetersToRunEquivalentMiles(bikeMeters: number): number {
  const m = Math.max(0, Number(bikeMeters) || 0);
  if (m <= 0) return 0;
  return (m / 1609.34) * RUN_MILES_PER_BIKE_MILE;
}

export function swimMetersToRunEquivalentMiles(swimMeters: number): number {
  const m = Math.max(0, Number(swimMeters) || 0);
  if (m <= 0) return 0;
  return (m / 100) * RUN_MILES_PER_100M_SWIM;
}
