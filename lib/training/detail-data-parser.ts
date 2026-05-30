/**
 * Parse raw Garmin activity detail JSON (detailData) into typed lap + sample rows.
 * Pure: no DB, no side effects.
 *
 * Supports both:
 * - flat lap summaries (distance/duration/pace/hr on each lap object)
 * - lap start times + per-second samples (legacy path)
 */

export type LapRow = {
  startTimeInSeconds: number;
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  avgSpeedMetersPerSecond?: number | null;
  avgHeartRate?: number | null;
};

export type SampleRow = {
  startTimeInSeconds: number;
  speedMetersPerSecond?: number | null;
  heartRate?: number | null;
  totalDistanceInMeters?: number | null;
};

export type ParsedDetailData = {
  laps: LapRow[];
  samples: SampleRow[];
};

function toNum(x: unknown): number | null {
  if (x == null) return null;
  if (typeof x === "number" && Number.isFinite(x)) return x;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function readHeartRate(obj: Record<string, unknown>): number | null {
  return (
    toNum(obj.heartRate) ??
    toNum(obj.HeartRate) ??
    toNum(obj.heartRateInBeatsPerMinute) ??
    toNum(obj.HeartRateInBeatsPerMinute) ??
    toNum(obj.averageHeartRateInBeatsPerMinute) ??
    toNum(obj.AverageHeartRateInBeatsPerMinute) ??
    null
  );
}

function readSpeed(obj: Record<string, unknown>): number | null {
  return (
    toNum(obj.speedMetersPerSecond) ??
    toNum(obj.SpeedMetersPerSecond) ??
    toNum(obj.averageSpeedInMetersPerSecond) ??
    toNum(obj.AverageSpeedInMetersPerSecond) ??
    null
  );
}

function readDurationSeconds(obj: Record<string, unknown>): number | null {
  return (
    toNum(obj.timerDurationInSeconds) ??
    toNum(obj.TimerDurationInSeconds) ??
    toNum(obj.durationInSeconds) ??
    toNum(obj.DurationInSeconds) ??
    toNum(obj.elapsedDurationInSeconds) ??
    toNum(obj.ElapsedDurationInSeconds) ??
    null
  );
}

function readDistanceMeters(obj: Record<string, unknown>): number | null {
  return (
    toNum(obj.totalDistanceInMeters) ??
    toNum(obj.TotalDistanceInMeters) ??
    toNum(obj.distanceInMeters) ??
    toNum(obj.DistanceInMeters) ??
    null
  );
}

function parseLapRow(item: Record<string, unknown>): LapRow | null {
  const t = toNum(item.startTimeInSeconds) ?? toNum(item.StartTimeInSeconds);
  if (t == null) return null;
  return {
    startTimeInSeconds: Math.floor(t),
    durationSeconds: readDurationSeconds(item),
    distanceMeters: readDistanceMeters(item),
    avgSpeedMetersPerSecond: readSpeed(item),
    avgHeartRate: readHeartRate(item),
  };
}

/**
 * @param blob - athlete_activities.detailData (or equivalent Garmin ACTIVITY_DETAIL body)
 */
export function parseDetailData(blob: unknown): ParsedDetailData {
  if (blob == null || typeof blob !== "object") {
    return { laps: [], samples: [] };
  }
  const o = blob as Record<string, unknown>;
  const rawLaps = (o.laps ?? o.Laps) as unknown;
  const rawSamples = (o.samples ?? o.Samples) as unknown;

  const laps: LapRow[] = [];
  if (Array.isArray(rawLaps)) {
    for (const item of rawLaps) {
      if (item == null || typeof item !== "object") continue;
      const row = parseLapRow(item as Record<string, unknown>);
      if (row) laps.push(row);
    }
  }

  const samples: SampleRow[] = [];
  if (Array.isArray(rawSamples)) {
    for (const item of rawSamples) {
      if (item == null || typeof item !== "object") continue;
      const s = item as Record<string, unknown>;
      const t = toNum(s.startTimeInSeconds) ?? toNum(s.StartTimeInSeconds);
      if (t == null) continue;
      const speed = readSpeed(s);
      const hr = readHeartRate(s);
      const dist = readDistanceMeters(s);
      samples.push({
        startTimeInSeconds: Math.floor(t),
        speedMetersPerSecond: speed,
        heartRate: hr,
        totalDistanceInMeters: dist,
      });
    }
  }

  return { laps, samples };
}

/** True when each lap row already carries usable summary metrics. */
export function lapsHaveFlatSummaries(laps: LapRow[]): boolean {
  if (laps.length === 0) return false;
  return laps.every(
    (lap) =>
      (lap.durationSeconds != null && lap.durationSeconds > 0) ||
      (lap.distanceMeters != null && lap.distanceMeters > 0) ||
      (lap.avgSpeedMetersPerSecond != null && lap.avgSpeedMetersPerSecond > 0)
  );
}
