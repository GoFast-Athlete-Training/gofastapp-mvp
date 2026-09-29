import { mapManageRunToProductRow } from "@/lib/runInstanceStub";
import { resolveClubInstanceLanesFromProductRuns } from "@/lib/server/resolve-club-instance-lanes";
import { getProductAppUrl } from "@/lib/server/training-product-proxy";

export type RunInstanceSummary = {
  id: string;
  title: string;
  date: string;
  published: boolean;
  workflowStatus: string;
  runSeriesId: string | null;
  meetUpPoint?: string | null;
  meetUpCity?: string | null;
  meetUpState?: string | null;
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  startTimePeriod?: string | null;
  totalMiles?: number | null;
  stravaMapUrl?: string | null;
  mapImageUrl?: string | null;
  routePhotos?: string[] | null;
  directionsText?: string | null;
  routeNeighborhood?: string | null;
  runType?: string | null;
  description?: string | null;
  workoutDescription?: string | null;
  rsvpCount?: number;
};

export type SeriesLaneSummary = {
  nextRun: RunInstanceSummary | null;
  latestPriorRun: RunInstanceSummary | null;
  expectedNextDateYmd: string | null;
  needsAdvance: boolean;
};

export type ClubInstanceStats = {
  instanceCount: number;
  upcomingInstanceCount: number;
  latestInstance: RunInstanceSummary | null;
  nextUpcomingInstance: RunInstanceSummary | null;
  instancesBySeriesId: Record<string, RunInstanceSummary[]>;
  instanceCountBySeriesId: Record<string, number>;
  lanesBySeriesId: Record<string, SeriesLaneSummary>;
  needsAdvanceCount: number;
};

type ProductRunRow = {
  id?: string;
  title?: string | null;
  date?: string | Date | null;
  startDate?: string | Date | null;
  published?: boolean;
  workflowStatus?: string | null;
  runClubId?: string | null;
  runSeriesId?: string | null;
  meetUpPoint?: string | null;
  meetUpCity?: string | null;
  meetUpState?: string | null;
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  startTimePeriod?: string | null;
  totalMiles?: number | null;
  stravaMapUrl?: string | null;
  mapImageUrl?: string | null;
  routePhotos?: unknown;
  directionsText?: string | null;
  routeNeighborhood?: string | null;
  runType?: string | null;
  description?: string | null;
  workoutDescription?: string | null;
  rsvpCount?: number;
};

function parseRoutePhotos(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const photos = value.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
  return photos.length > 0 ? photos : null;
}

function parseTotalMiles(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function getStartOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toIsoDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toSummary(run: ProductRunRow): RunInstanceSummary | null {
  const date = toIsoDate(run.date ?? run.startDate);
  if (!date || !run.id) return null;

  const workflowStatus = String(run.workflowStatus || "DEVELOP");
  const published = run.published === true;

  return {
    id: String(run.id),
    title: String(run.title || "Untitled Run"),
    date,
    published,
    workflowStatus,
    runSeriesId: run.runSeriesId != null ? String(run.runSeriesId) : null,
    meetUpPoint: run.meetUpPoint?.trim() || null,
    meetUpCity: run.meetUpCity?.trim() || null,
    meetUpState: run.meetUpState?.trim() || null,
    startTimeHour: run.startTimeHour ?? null,
    startTimeMinute: run.startTimeMinute ?? null,
    startTimePeriod: run.startTimePeriod?.trim() || null,
    totalMiles: parseTotalMiles(run.totalMiles),
    stravaMapUrl: run.stravaMapUrl?.trim() || null,
    mapImageUrl: run.mapImageUrl?.trim() || null,
    routePhotos: parseRoutePhotos(run.routePhotos),
    directionsText: run.directionsText?.trim() || null,
    routeNeighborhood: run.routeNeighborhood?.trim() || null,
    runType: run.runType?.trim() || null,
    description: run.description?.trim() || null,
    workoutDescription: run.workoutDescription?.trim() || null,
    rsvpCount: typeof run.rsvpCount === "number" ? run.rsvpCount : 0,
  };
}

function emptyStats(): ClubInstanceStats {
  return {
    instanceCount: 0,
    upcomingInstanceCount: 0,
    latestInstance: null,
    nextUpcomingInstance: null,
    instancesBySeriesId: {},
    instanceCountBySeriesId: {},
    lanesBySeriesId: {},
    needsAdvanceCount: 0,
  };
}

function laneRunToSummary(run: {
  id: string;
  title: string;
  date: string;
  published: boolean;
  workflowStatus: string;
  runSeriesId: string;
  meetUpPoint?: string | null;
  meetUpCity?: string | null;
  meetUpState?: string | null;
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  startTimePeriod?: string | null;
  totalMiles?: number | null;
  stravaMapUrl?: string | null;
  mapImageUrl?: string | null;
  routePhotos?: string[] | null;
  directionsText?: string | null;
  routeNeighborhood?: string | null;
  runType?: string | null;
  description?: string | null;
  workoutDescription?: string | null;
  rsvpCount?: number;
}): RunInstanceSummary {
  return {
    id: run.id,
    title: run.title,
    date: run.date,
    published: run.published,
    workflowStatus: run.workflowStatus,
    runSeriesId: run.runSeriesId,
    meetUpPoint: run.meetUpPoint ?? null,
    meetUpCity: run.meetUpCity ?? null,
    meetUpState: run.meetUpState ?? null,
    startTimeHour: run.startTimeHour ?? null,
    startTimeMinute: run.startTimeMinute ?? null,
    startTimePeriod: run.startTimePeriod ?? null,
    totalMiles: run.totalMiles ?? null,
    stravaMapUrl: run.stravaMapUrl ?? null,
    mapImageUrl: run.mapImageUrl ?? null,
    routePhotos: run.routePhotos ?? null,
    directionsText: run.directionsText ?? null,
    routeNeighborhood: run.routeNeighborhood ?? null,
    runType: run.runType ?? null,
    description: run.description ?? null,
    workoutDescription: run.workoutDescription ?? null,
    rsvpCount: run.rsvpCount ?? 0,
  };
}

/** Load compact dated run instance stats for many clubs via Product /api/runs/manage. */
export async function loadRunInstanceSummariesByClubIds(
  clubIds: string[],
  authHeader: string
): Promise<Map<string, ClubInstanceStats>> {
  const map = new Map<string, ClubInstanceStats>();
  if (clubIds.length === 0) return map;

  for (const id of clubIds) {
    map.set(id, emptyStats());
  }

  const clubIdSet = new Set(clubIds);
  const productAppUrl = getProductAppUrl();
  const params = new URLSearchParams({ upcomingOnly: "false" });
  const proxyUrl = `${productAppUrl}/api/runs/manage?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(proxyUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.warn("[loadRunInstanceSummariesByClubIds] Product fetch failed:", error);
    return map;
  }

  let data: { success?: boolean; runs?: ProductRunRow[] };
  try {
    data = await response.json();
  } catch {
    console.warn(
      `[loadRunInstanceSummariesByClubIds] Non-JSON response (${response.status})`
    );
    return map;
  }

  if (!response.ok || !data.success || !Array.isArray(data.runs)) {
    console.warn(
      `[loadRunInstanceSummariesByClubIds] Product error (${response.status}):`,
      data
    );
    return map;
  }

  const startOfToday = getStartOfTodayUTC();
  const byClub = new Map<
    string,
    {
      instances: RunInstanceSummary[];
      bySeries: Record<string, RunInstanceSummary[]>;
      productRows: ReturnType<typeof mapManageRunToProductRow>[];
    }
  >();

  for (const run of data.runs) {
    const clubId = run.runClubId?.trim();
    if (!clubId || !clubIdSet.has(clubId)) continue;

    const summary = toSummary(run);
    if (!summary) continue;

    let bucket = byClub.get(clubId);
    if (!bucket) {
      bucket = { instances: [], bySeries: {}, productRows: [] };
      byClub.set(clubId, bucket);
    }
    bucket.instances.push(summary);
    bucket.productRows.push(mapManageRunToProductRow(run as Record<string, unknown>));

    if (summary.runSeriesId) {
      const seriesList = bucket.bySeries[summary.runSeriesId] ?? [];
      seriesList.push(summary);
      bucket.bySeries[summary.runSeriesId] = seriesList;
    }
  }

  for (const clubId of clubIds) {
    const bucket = byClub.get(clubId);
    if (!bucket) continue;

    const instances = bucket.instances.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const upcoming = instances
      .filter((r) => new Date(r.date) >= startOfToday)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const instancesBySeriesId: Record<string, RunInstanceSummary[]> = {};
    const instanceCountBySeriesId: Record<string, number> = {};
    for (const [seriesId, rows] of Object.entries(bucket.bySeries)) {
      const sorted = rows.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      instanceCountBySeriesId[seriesId] = sorted.length;
      instancesBySeriesId[seriesId] = sorted.slice(0, 5);
    }

    const lanes = resolveClubInstanceLanesFromProductRuns(bucket.productRows, clubId);
    const lanesBySeriesId: Record<string, SeriesLaneSummary> = {};
    let needsAdvanceCount = 0;
    for (const lane of lanes) {
      lanesBySeriesId[lane.runSeriesId] = {
        nextRun: lane.nextRun ? laneRunToSummary(lane.nextRun) : null,
        latestPriorRun: lane.latestPriorRun ? laneRunToSummary(lane.latestPriorRun) : null,
        expectedNextDateYmd: lane.expectedNextDateYmd,
        needsAdvance: lane.needsAdvance,
      };
      if (lane.needsAdvance) needsAdvanceCount++;
    }

    map.set(clubId, {
      instanceCount: instances.length,
      upcomingInstanceCount: upcoming.length,
      latestInstance: instances[0] ?? null,
      nextUpcomingInstance: upcoming[0] ?? null,
      instancesBySeriesId,
      instanceCountBySeriesId,
      lanesBySeriesId,
      needsAdvanceCount,
    });
  }

  return map;
}
