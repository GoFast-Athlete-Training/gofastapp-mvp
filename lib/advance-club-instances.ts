import { Prisma } from "@prisma/client";
import {
  addCalendarDays,
  dateKeyFromDate,
  dateKeyToUtcNoonDate,
  dateKeyToUtcStartOfDay,
} from "@/lib/calendar-date";
import { prisma } from "@/lib/prisma";
import { generateUniqueCityRunSlug } from "@/lib/slug-utils";

export type RunInstanceSummary = {
  id: string;
  title: string;
  date: string;
  published: boolean;
  workflowStatus: string;
  runSeriesId: string;
  runClubId: string | null;
};

export type InstanceLane = {
  runSeriesId: string;
  nextRun: RunInstanceSummary | null;
  expectedNextDateYmd: string | null;
  latestPriorRun: RunInstanceSummary | null;
  historicalRuns: RunInstanceSummary[];
  needsAdvance: boolean;
};

export type AdvanceResult = {
  runSeriesId: string;
  priorRunId: string;
  targetDateYmd: string;
  outcome: "found_existing" | "created" | "skipped_no_prior" | "error";
  runId?: string;
  error?: string;
};

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

export function getStartOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function dateToYmd(date: Date): string {
  return dateKeyFromDate(date);
}

export function parseYmd(ymd: string): Date {
  return dateKeyToUtcNoonDate(ymd);
}

export function addDaysUtc(date: Date, days: number): Date {
  return dateKeyToUtcNoonDate(addCalendarDays(date, days));
}

function dayRangeUtc(ymd: string): { start: Date; end: Date } {
  const start = dateKeyToUtcStartOfDay(ymd);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function mapRunSummary(run: {
  id: string;
  title: string;
  date: Date;
  published: boolean;
  workflowStatus: string;
  runSeriesId: string | null;
  runClubId: string | null;
}): RunInstanceSummary | null {
  if (!run.runSeriesId) return null;
  return {
    id: run.id,
    title: run.title,
    date: run.date.toISOString(),
    published: run.published,
    workflowStatus: run.workflowStatus,
    runSeriesId: run.runSeriesId,
    runClubId: run.runClubId,
  };
}

function runInstanceDateSuffix(dateYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!m) return "";
  return ` (${Number(m[2])}/${Number(m[3])})`;
}

export function titleForAdvancedDate(priorTitle: string, targetYmd: string): string {
  const suffix = runInstanceDateSuffix(targetYmd);
  const withoutOldSuffix = priorTitle.replace(/\s*\(\d{1,2}\/\d{1,2}\)\s*$/, "").trim();
  return `${withoutOldSuffix}${suffix}`;
}

const CLUB_RUN_SELECT = {
  id: true,
  title: true,
  date: true,
  published: true,
  workflowStatus: true,
  runSeriesId: true,
  runClubId: true,
  gofastCity: true,
  slug: true,
  dayOfWeek: true,
  timezone: true,
  meetUpPoint: true,
  meetUpPlaceId: true,
  meetUpLat: true,
  meetUpLng: true,
  meetUpStreetAddress: true,
  meetUpCity: true,
  meetUpState: true,
  meetUpZip: true,
  endPoint: true,
  endStreetAddress: true,
  endCity: true,
  endState: true,
  totalMiles: true,
  pace: true,
  stravaMapUrl: true,
  stravaUrl: true,
  stravaText: true,
  webUrl: true,
  webText: true,
  igPostText: true,
  igPostGraphic: true,
  description: true,
  postRunActivity: true,
  routePhotos: true,
  mapImageUrl: true,
  staffNotes: true,
  startTimeHour: true,
  startTimeMinute: true,
  startTimePeriod: true,
  routeNeighborhood: true,
  runType: true,
  workoutDescription: true,
  routeId: true,
  workoutId: true,
  cityRunType: true,
  staffGeneratedId: true,
} as const;

/** All club runs with a parent series id, newest first. */
export async function fetchClubSeriesRuns(runClubId: string) {
  return prisma.city_runs.findMany({
    where: {
      runClubId,
      runSeriesId: { not: null },
    },
    select: CLUB_RUN_SELECT,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

async function findRunOnDate(
  runClubId: string,
  runSeriesId: string,
  dateYmd: string
) {
  const { start, end } = dayRangeUtc(dateYmd);
  return prisma.city_runs.findFirst({
    where: {
      runClubId,
      runSeriesId,
      date: { gte: start, lt: end },
    },
    select: {
      id: true,
      title: true,
      date: true,
      published: true,
      workflowStatus: true,
      runSeriesId: true,
      runClubId: true,
    },
  });
}

/** Resolve next / historical lanes per parent runSeriesId (Product-only). */
export async function resolveClubInstanceLanes(
  runClubId: string
): Promise<InstanceLane[]> {
  const runs = await fetchClubSeriesRuns(runClubId);
  const startOfToday = getStartOfTodayUTC();

  const bySeries = new Map<string, typeof runs>();
  for (const run of runs) {
    if (!run.runSeriesId) continue;
    const list = bySeries.get(run.runSeriesId) ?? [];
    list.push(run);
    bySeries.set(run.runSeriesId, list);
  }

  const lanes: InstanceLane[] = [];

  for (const [runSeriesId, seriesRuns] of bySeries) {
    const summaries = seriesRuns
      .map(mapRunSummary)
      .filter((r): r is RunInstanceSummary => r != null);

    const historical = summaries.filter((r) => new Date(r.date) < startOfToday);
    const futureOrToday = summaries.filter((r) => new Date(r.date) >= startOfToday);

    historical.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    futureOrToday.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const latestPriorRun = historical[0] ?? null;
    const nextRun = futureOrToday[0] ?? null;

    let expectedNextDateYmd: string | null = null;
    if (latestPriorRun) {
      let target = addDaysUtc(new Date(latestPriorRun.date), 7);
      while (target < startOfToday) {
        target = addDaysUtc(target, 7);
      }
      expectedNextDateYmd = dateToYmd(target);
    }

    const needsAdvance =
      !nextRun && latestPriorRun != null && expectedNextDateYmd != null;

    lanes.push({
      runSeriesId,
      nextRun,
      expectedNextDateYmd,
      latestPriorRun,
      historicalRuns: historical,
      needsAdvance,
    });
  }

  lanes.sort((a, b) => {
    const aDate = a.nextRun?.date ?? a.latestPriorRun?.date ?? "";
    const bDate = b.nextRun?.date ?? b.latestPriorRun?.date ?? "";
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return lanes;
}

function targetDateFromPrior(priorDate: Date): string {
  const startOfToday = getStartOfTodayUTC();
  let target = addDaysUtc(priorDate, 7);
  while (target < startOfToday) {
    target = addDaysUtc(target, 7);
  }
  return dateToYmd(target);
}

async function duplicateRunForward(
  prior: Awaited<ReturnType<typeof fetchClubSeriesRuns>>[number],
  targetYmd: string,
  staffGeneratedId?: string | null
) {
  const targetDate = parseYmd(targetYmd);
  const title = titleForAdvancedDate(prior.title, targetYmd);

  let clubSlug: string | null = null;
  if (prior.runClubId) {
    const club = await prisma.run_clubs.findUnique({
      where: { id: prior.runClubId },
      select: { slug: true },
    });
    clubSlug = club?.slug?.trim() || null;
  }

  let runSlug: string | null = null;
  try {
    runSlug = await generateUniqueCityRunSlug(title, {
      date: targetDate,
      clubSlug,
    });
  } catch {
    runSlug = null;
  }

  const createData: Record<string, unknown> = {
    id: generateId(),
    gofastCity: prior.gofastCity,
    slug: runSlug,
    runClubId: prior.runClubId,
    runSeriesId: prior.runSeriesId,
    staffGeneratedId: staffGeneratedId?.trim() || prior.staffGeneratedId || null,
    athleteGeneratedId: null,
    runCrewId: null,
    title,
    workflowStatus: "DEVELOP",
    published: false,
    dayOfWeek: prior.dayOfWeek,
    date: targetDate,
    startTimeHour: prior.startTimeHour,
    startTimeMinute: prior.startTimeMinute,
    startTimePeriod: prior.startTimePeriod,
    timezone: prior.timezone,
    meetUpPoint: prior.meetUpPoint,
    meetUpStreetAddress: prior.meetUpStreetAddress,
    meetUpCity: prior.meetUpCity,
    meetUpState: prior.meetUpState,
    meetUpZip: prior.meetUpZip,
    meetUpPlaceId: prior.meetUpPlaceId,
    meetUpLat: prior.meetUpLat,
    meetUpLng: prior.meetUpLng,
    endPoint: prior.endPoint,
    endStreetAddress: prior.endStreetAddress,
    endCity: prior.endCity,
    endState: prior.endState,
    totalMiles: prior.totalMiles,
    pace: prior.pace,
    stravaMapUrl: prior.stravaMapUrl,
    stravaUrl: prior.stravaUrl,
    stravaText: prior.stravaText,
    webUrl: prior.webUrl,
    webText: prior.webText,
    igPostText: prior.igPostText,
    igPostGraphic: prior.igPostGraphic,
    description: prior.description,
    postRunActivity: prior.postRunActivity,
    routePhotos: prior.routePhotos ?? Prisma.JsonNull,
    mapImageUrl: prior.mapImageUrl,
    staffNotes: prior.staffNotes,
    routeNeighborhood: prior.routeNeighborhood,
    runType: prior.runType,
    workoutDescription: prior.workoutDescription,
    routeId: prior.routeId,
    workoutId: prior.workoutId,
    cityRunType: prior.cityRunType,
    updatedAt: new Date(),
  };

  const created = await prisma.city_runs.create({
    data: createData as Parameters<typeof prisma.city_runs.create>[0]["data"],
    select: {
      id: true,
      title: true,
      date: true,
      published: true,
      workflowStatus: true,
      runSeriesId: true,
      runClubId: true,
    },
  });

  return created;
}

/**
 * Product-first find-or-create: duplicate latest prior instance per runSeriesId +7 days.
 * Does not touch Company acq tables.
 */
export async function advanceClubInstances(opts: {
  runClubId: string;
  staffGeneratedId?: string | null;
  runSeriesIds?: string[];
}): Promise<AdvanceResult[]> {
  const { runClubId, staffGeneratedId } = opts;
  const filterIds =
    Array.isArray(opts.runSeriesIds) && opts.runSeriesIds.length > 0
      ? new Set(opts.runSeriesIds.map(String))
      : null;

  const runs = await fetchClubSeriesRuns(runClubId);
  const startOfToday = getStartOfTodayUTC();

  const latestPriorBySeries = new Map<
    string,
    (typeof runs)[number]
  >();

  for (const run of runs) {
    if (!run.runSeriesId) continue;
    if (filterIds && !filterIds.has(run.runSeriesId)) continue;
    if (run.date >= startOfToday) continue;
    const existing = latestPriorBySeries.get(run.runSeriesId);
    if (!existing || run.date > existing.date) {
      latestPriorBySeries.set(run.runSeriesId, run);
    }
  }

  const results: AdvanceResult[] = [];

  for (const [runSeriesId, prior] of latestPriorBySeries) {
    const targetYmd = targetDateFromPrior(prior.date);

    try {
      const existing = await findRunOnDate(runClubId, runSeriesId, targetYmd);
      if (existing) {
        results.push({
          runSeriesId,
          priorRunId: prior.id,
          targetDateYmd: targetYmd,
          outcome: "found_existing",
          runId: existing.id,
        });
        continue;
      }

      const created = await duplicateRunForward(prior, targetYmd, staffGeneratedId);
      results.push({
        runSeriesId,
        priorRunId: prior.id,
        targetDateYmd: targetYmd,
        outcome: "created",
        runId: created.id,
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      results.push({
        runSeriesId,
        priorRunId: prior.id,
        targetDateYmd: targetYmd,
        outcome: "error",
        error: err?.message || "Failed to advance instance",
      });
    }
  }

  if (filterIds) {
    for (const seriesId of filterIds) {
      if (!latestPriorBySeries.has(seriesId)) {
        results.push({
          runSeriesId: seriesId,
          priorRunId: "",
          targetDateYmd: "",
          outcome: "skipped_no_prior",
        });
      }
    }
  }

  return results;
}
