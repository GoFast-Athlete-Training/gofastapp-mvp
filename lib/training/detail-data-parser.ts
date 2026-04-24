/**
 * Parse raw Garmin activity detail JSON (detailData) into typed lap + sample rows.
 * Pure: no DB, no side effects.
 */

export type LapRow = { startTimeInSeconds: number };

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

function readHeartRate(s: Record<string, unknown>): number | null {
  return (
    toNum(s.heartRate) ??
    toNum(s.HeartRate) ??
    toNum(s.heartRateInBeatsPerMinute) ??
    toNum(s.HeartRateInBeatsPerMinute) ??
    null
  );
}

function readSpeed(s: Record<string, unknown>): number | null {
  return toNum(s.speedMetersPerSecond) ?? toNum(s.SpeedMetersPerSecond) ?? null;
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
      const lo = item as Record<string, unknown>;
      const t = toNum(lo.startTimeInSeconds) ?? toNum(lo.StartTimeInSeconds);
      if (t == null) continue;
      laps.push({ startTimeInSeconds: Math.floor(t) });
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
      const dist =
        toNum(s.totalDistanceInMeters) ?? toNum(s.TotalDistanceInMeters) ?? null;
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
