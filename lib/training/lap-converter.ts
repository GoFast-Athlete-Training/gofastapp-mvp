/**
 * Build derived lap stats from parsed lap start times + per-second/period samples.
 * Pure: no DB.
 */

import type { LapRow, SampleRow } from "./detail-data-parser";

const METERS_PER_MILE = 1609.34;

export type DerivedLap = {
  lapIndex: number;
  startTimeInSeconds: number;
  endTimeInSeconds: number;
  avgPaceSecPerMile: number | null;
  avgHeartRate: number | null;
  distanceMiles: number | null;
  durationSeconds: number;
};

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(
    nums.reduce((a, b) => a + b, 0) / nums.length
  );
}

/**
 * @param sortSamples - optional pre-sorted samples (by start time ascending)
 */
export function convertLapsToDerived(
  laps: LapRow[],
  samples: SampleRow[]
): DerivedLap[] {
  if (laps.length === 0) return [];

  const sorted = [...samples].sort(
    (a, b) => a.startTimeInSeconds - b.startTimeInSeconds
  );
  if (sorted.length === 0) {
    return laps.map((lap, i) => ({
      lapIndex: i,
      startTimeInSeconds: lap.startTimeInSeconds,
      endTimeInSeconds: lap.startTimeInSeconds,
      avgPaceSecPerMile: null,
      avgHeartRate: null,
      distanceMiles: null,
      durationSeconds: 0,
    }));
  }

  const lastSampleT = sorted[sorted.length - 1]!.startTimeInSeconds;
  const endBuffer = 2; // same spirit as evaluate-lap-segments

  const out: DerivedLap[] = [];
  for (let i = 0; i < laps.length; i++) {
    const t0 = laps[i]!.startTimeInSeconds;
    const t1 =
      i + 1 < laps.length
        ? laps[i + 1]!.startTimeInSeconds
        : lastSampleT + endBuffer;

    const inWin = sorted.filter(
      (s) =>
        s.startTimeInSeconds >= t0 &&
        s.startTimeInSeconds < t1
    );
    const dur = Math.max(0, t1 - t0);

    const speeds: number[] = [];
    const hrs: number[] = [];
    for (const s of inWin) {
      if (s.speedMetersPerSecond != null && s.speedMetersPerSecond > 0) {
        speeds.push(s.speedMetersPerSecond);
      }
      if (s.heartRate != null && s.heartRate > 0) {
        hrs.push(s.heartRate);
      }
    }

    const avgMps = speeds.length
      ? speeds.reduce((a, b) => a + b, 0) / speeds.length
      : null;
    const paceSec =
      avgMps != null && avgMps > 0
        ? Math.round(METERS_PER_MILE / avgMps)
        : null;

    let distMiles: number | null = null;
    if (avgMps != null && avgMps > 0 && dur > 0) {
      distMiles = (avgMps * dur) / METERS_PER_MILE;
      distMiles = Math.round(distMiles * 100) / 100;
    }

    out.push({
      lapIndex: i,
      startTimeInSeconds: t0,
      endTimeInSeconds: t1,
      avgPaceSecPerMile: paceSec,
      avgHeartRate: mean(hrs),
      distanceMiles: distMiles,
      durationSeconds: Math.round(dur),
    });
  }
  return out;
}
