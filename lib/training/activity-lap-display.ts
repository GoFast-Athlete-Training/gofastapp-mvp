/**
 * Display-only lap rows from Garmin detail or summary actuals (unplanned / spawned workouts).
 */

import { normalizeActivityLapsFromDetail, type DerivedLap } from '@/lib/training/lap-converter';

const METERS_PER_MILE = 1609.34;

export type ActivityDerivedLapRow = {
  lapIndex: number;
  distanceMiles: number | null;
  paceSecPerMile: number | null;
  durationSeconds: number | null;
  /** Human time-of-day label when start time is known */
  startTimeLabel: string | null;
};

export function deriveActivityLapsForDisplay(params: {
  detailData?: unknown;
  hydratedAt?: Date | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  startTime?: Date | string | null;
}): ActivityDerivedLapRow[] {
  const fromDetail =
    params.detailData != null && params.hydratedAt
      ? normalizeActivityLapsFromDetail(params.detailData)
      : [];

  if (fromDetail.length > 0) {
    return fromDetail.map(mapDerivedLap);
  }

  const distanceMeters = params.distanceMeters ?? null;
  const durationSeconds = params.durationSeconds ?? null;
  if (
    (distanceMeters == null || distanceMeters <= 0) &&
    (durationSeconds == null || durationSeconds <= 0)
  ) {
    return [];
  }

  const distanceMiles =
    distanceMeters != null && distanceMeters > 0
      ? Math.round((distanceMeters / METERS_PER_MILE) * 100) / 100
      : null;
  let paceSecPerMile: number | null = null;
  if (distanceMiles != null && durationSeconds != null && durationSeconds > 0 && distanceMiles > 0) {
    paceSecPerMile = Math.round(durationSeconds / distanceMiles);
  }

  return [
    {
      lapIndex: 0,
      distanceMiles,
      paceSecPerMile,
      durationSeconds: durationSeconds ?? null,
      startTimeLabel: formatStartTimeLabel(params.startTime),
    },
  ];
}

function mapDerivedLap(lap: DerivedLap): ActivityDerivedLapRow {
  return {
    lapIndex: lap.lapIndex,
    distanceMiles: lap.distanceMiles,
    paceSecPerMile: lap.avgPaceSecPerMile,
    durationSeconds: lap.durationSeconds > 0 ? lap.durationSeconds : null,
    startTimeLabel: null,
  };
}

function formatStartTimeLabel(startTime: Date | string | null | undefined): string | null {
  if (!startTime) return null;
  try {
    const d = startTime instanceof Date ? startTime : new Date(startTime);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return null;
  }
}
