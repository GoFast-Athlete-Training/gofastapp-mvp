/**
 * Normalize Garmin activity payload into our athlete_activities schema fields.
 * Handles both short names (duration, distance) and Garmin API long names
 * (durationInSeconds, distanceInMeters, startTimeInSeconds, etc.).
 */

export interface NormalizedActivityFields {
  startTime: Date | null;
  duration: number | undefined;
  distance: number | undefined;
  calories: number | undefined;
  averageSpeed: number | undefined;
  averageHeartRate: number | undefined;
  maxHeartRate: number | undefined;
  elevationGain: number | undefined;
  steps: number | undefined;
}

function getNum(obj: any, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

/**
 * Normalize raw Garmin activity (webhook or API) to our DB fields.
 * Prefer long names (Garmin Data Generator / Wellness API), fallback to short.
 */
export function normalizeActivityFields(activity: any): NormalizedActivityFields {
  const raw = activity && typeof activity === 'object' ? activity : {};
  const startTimeRaw = raw.startTime ?? raw.startTimeInSeconds;
  const startTime =
    startTimeRaw != null
      ? new Date(
          typeof startTimeRaw === 'string'
            ? startTimeRaw
            : (startTimeRaw as number) < 1e12
              ? (startTimeRaw as number) * 1000
              : (startTimeRaw as number)
        )
      : null;

  const duration =
    getNum(raw, 'duration', 'durationInSeconds') != null
      ? Math.round(Number(getNum(raw, 'duration', 'durationInSeconds')))
      : undefined;
  const distance = getNum(raw, 'distance', 'distanceInMeters');
  const calories =
    getNum(raw, 'calories', 'activeKilocalories') != null
      ? Math.round(Number(getNum(raw, 'calories', 'activeKilocalories')))
      : undefined;
  const averageSpeed = getNum(raw, 'averageSpeed', 'averageSpeedInMetersPerSecond');
  const averageHeartRate =
    getNum(raw, 'averageHeartRate', 'averageHeartRateInBeatsPerMinute') != null
      ? Math.round(Number(getNum(raw, 'averageHeartRate', 'averageHeartRateInBeatsPerMinute')))
      : undefined;
  const maxHeartRate =
    getNum(raw, 'maxHeartRate', 'maxHeartRateInBeatsPerMinute') != null
      ? Math.round(Number(getNum(raw, 'maxHeartRate', 'maxHeartRateInBeatsPerMinute')))
      : undefined;
  const elevationGain = getNum(raw, 'elevationGain', 'totalElevationGainInMeters');
  const steps =
    getNum(raw, 'steps') != null ? Math.round(Number(getNum(raw, 'steps'))) : undefined;

  return {
    startTime,
    duration,
    distance,
    calories,
    averageSpeed,
    averageHeartRate,
    maxHeartRate,
    elevationGain,
    steps,
  };
}
