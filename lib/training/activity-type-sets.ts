/**
 * Garmin Health / activity summary `activityType` values (typically SCREAMING_SNAKE_CASE).
 * Used to route webhook ingest to the correct workout matcher.
 */

export const RUNNING_ACTIVITY_TYPES = new Set(
  [
    "RUNNING",
    "TRACK_RUNNING",
    "TREADMILL_RUNNING",
    "INDOOR_TRACK",
    "TRAIL_RUNNING",
    "VIRTUAL_RUNNING",
    "STREET_RUNNING",
  ].map((s) => s.toUpperCase())
);

export const CYCLING_ACTIVITY_TYPES = new Set(
  [
    "CYCLING",
    "ROAD_CYCLING",
    "INDOOR_CYCLING",
    "TRACK_CYCLING",
    "MOUNTAIN_BIKING",
    "VIRTUAL_RIDE",
    "GRAVEL_CYCLING",
    "E_BIKE_MOUNTAIN",
    "E_BIKE_FITNESS",
  ].map((s) => s.toUpperCase())
);

export function isCyclingActivityType(activityType: string | null | undefined): boolean {
  if (!activityType) return false;
  return CYCLING_ACTIVITY_TYPES.has(activityType.toUpperCase());
}
