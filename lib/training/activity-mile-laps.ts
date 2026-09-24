/**
 * Display-only mile splits for general (no-segment) workouts.
 * Accumulates Garmin detail/FIT lap distance — not raw lap index labels.
 */

import { normalizeActivityLapsPreferDetail } from "@/lib/training/lap-converter";

const METERS_PER_MILE = 1609.34;

export type ActivityMileLapRow = {
  mileIndex: number;
  distanceMiles: number | null;
  paceSecPerMile: number | null;
  durationSeconds: number | null;
};

export function buildActivityMileLapsFromActivityDetail(params: {
  detailData?: unknown;
  fitLapData?: unknown;
}): ActivityMileLapRow[] {
  const derived = normalizeActivityLapsPreferDetail({
    detailData: params.detailData,
    fitLapData: params.fitLapData,
  });
  if (derived.length === 0) return [];

  const rows: ActivityMileLapRow[] = [];
  let mileIndex = 0;
  let accDistanceMiles = 0;
  let accDurationSeconds = 0;

  const flushMile = () => {
    if (accDistanceMiles <= 0 && accDurationSeconds <= 0) return;
    const paceSecPerMile =
      accDistanceMiles > 0 && accDurationSeconds > 0
        ? Math.round(accDurationSeconds / accDistanceMiles)
        : null;
    rows.push({
      mileIndex,
      distanceMiles: accDistanceMiles > 0 ? Math.round(accDistanceMiles * 100) / 100 : null,
      paceSecPerMile,
      durationSeconds: accDurationSeconds > 0 ? accDurationSeconds : null,
    });
    mileIndex += 1;
    accDistanceMiles = 0;
    accDurationSeconds = 0;
  };

  for (const lap of derived) {
    const lapMiles =
      lap.distanceMiles ??
      (lap.durationSeconds > 0 && lap.avgPaceSecPerMile != null && lap.avgPaceSecPerMile > 0
        ? lap.durationSeconds / lap.avgPaceSecPerMile
        : 0);
    const lapDur = lap.durationSeconds > 0 ? lap.durationSeconds : 0;

    if (lapMiles <= 0 && lapDur <= 0) continue;

    let remainingMiles = lapMiles;
    let remainingDur = lapDur;

    while (remainingMiles > 0.0001) {
      const roomInMile = Math.max(0, 1 - accDistanceMiles);
      if (roomInMile <= 0.0001) {
        flushMile();
        continue;
      }
      const takeMiles = Math.min(remainingMiles, roomInMile);
      const durShare =
        lapMiles > 0 && lapDur > 0 ? Math.round((takeMiles / lapMiles) * lapDur) : 0;
      accDistanceMiles += takeMiles;
      accDurationSeconds += durShare;
      remainingMiles -= takeMiles;
      remainingDur -= durShare;

      if (accDistanceMiles >= 0.999) {
        flushMile();
      }
    }

    if (remainingMiles <= 0.0001 && lapMiles <= 0 && remainingDur > 0) {
      accDurationSeconds += remainingDur;
    }
  }

  if (accDistanceMiles > 0.01 || accDurationSeconds > 0) {
    flushMile();
  }

  return rows;
}

/** Re-export for tests that need meter-based sanity. */
export { METERS_PER_MILE };
