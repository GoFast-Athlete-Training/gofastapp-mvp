import { normalizeActivityLapsFromDetail, type DerivedLap } from "./lap-converter";
import { extractActivityRouteFromDetail } from "./activity-route-from-detail";

export type ActivityDerivedLapRow = {
  lapIndex: number;
  durationSeconds: number;
  distanceMiles: number | null;
  avgPaceSecPerMile: number | null;
  avgHeartRate: number | null;
};

export function mapDerivedLapsForClient(laps: DerivedLap[]): ActivityDerivedLapRow[] {
  return laps.map((lap) => ({
    lapIndex: lap.lapIndex,
    durationSeconds: lap.durationSeconds,
    distanceMiles: lap.distanceMiles,
    avgPaceSecPerMile: lap.avgPaceSecPerMile,
    avgHeartRate: lap.avgHeartRate,
  }));
}

type ActivityRow = {
  detailData: unknown;
  hydratedAt: Date | null;
  summaryPolyline: string | null;
  startLatitude: number | null;
  startLongitude: number | null;
  endLatitude: number | null;
  endLongitude: number | null;
  summaryData?: unknown;
  [key: string]: unknown;
};

export function projectActivityDetailResponse<T extends ActivityRow>(row: T): {
  activity: Omit<T, "detailData" | "summaryData"> & {
    summaryPolyline: string | null;
    startLatitude: number | null;
    startLongitude: number | null;
    endLatitude: number | null;
    endLongitude: number | null;
  };
  derivedLaps: ActivityDerivedLapRow[];
  hasDetail: boolean;
} {
  const { detailData, summaryData: _summaryData, ...rest } = row;
  const hasDetail = row.hydratedAt != null && detailData != null;

  let summaryPolyline = row.summaryPolyline;
  let startLatitude = row.startLatitude;
  let startLongitude = row.startLongitude;
  let endLatitude = row.endLatitude;
  let endLongitude = row.endLongitude;

  if (hasDetail && !summaryPolyline) {
    const route = extractActivityRouteFromDetail(detailData);
    summaryPolyline = route.summaryPolyline;
    startLatitude = route.startLatitude;
    startLongitude = route.startLongitude;
    endLatitude = route.endLatitude;
    endLongitude = route.endLongitude;
  }

  const derivedLaps = hasDetail
    ? mapDerivedLapsForClient(normalizeActivityLapsFromDetail(detailData))
    : [];

  return {
    activity: {
      ...rest,
      summaryPolyline,
      startLatitude,
      startLongitude,
      endLatitude,
      endLongitude,
    },
    derivedLaps,
    hasDetail,
  };
}
