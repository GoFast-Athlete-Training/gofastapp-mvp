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

/** How many weekly occurrence slots advance should keep filled ahead of today. */
export const DEFAULT_ADVANCE_HORIZON_WEEKS = 2;

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

/** Next N weekly dates on or after today, stepping from the latest prior occurrence. */
export function getHorizonTargetDatesFromPrior(
  priorDate: Date,
  horizonWeeks: number = DEFAULT_ADVANCE_HORIZON_WEEKS,
  startOfToday: Date = getStartOfTodayUTC()
): string[] {
  let target = addDaysUtc(priorDate, 7);
  while (target < startOfToday) {
    target = addDaysUtc(target, 7);
  }
  const dates: string[] = [];
  for (let i = 0; i < horizonWeeks; i++) {
    dates.push(dateToYmd(addDaysUtc(target, i * 7)));
  }
  return dates;
}

export function computeLaneAdvanceState(
  latestPriorDate: Date | null,
  futureOrTodayDates: Date[],
  horizonWeeks: number = DEFAULT_ADVANCE_HORIZON_WEEKS,
  startOfToday: Date = getStartOfTodayUTC()
): {
  needsAdvance: boolean;
  expectedNextDateYmd: string | null;
  horizonDates: string[];
} {
  if (!latestPriorDate) {
    return { needsAdvance: false, expectedNextDateYmd: null, horizonDates: [] };
  }
  const horizonDates = getHorizonTargetDatesFromPrior(
    latestPriorDate,
    horizonWeeks,
    startOfToday
  );
  const futureYmds = new Set(futureOrTodayDates.map((d) => dateToYmd(d)));
  const missing = horizonDates.filter((d) => !futureYmds.has(d));
  return {
    needsAdvance: missing.length > 0,
    expectedNextDateYmd: missing[0] ?? null,
    horizonDates,
  };
}

const CLUB_RUN_SELECT = {
  id: true,
  title: true,
  date: true,
  published: true,
  workflowStatus: true,
  runSeriesId: true,
  runClubId: true,
  citySlug: true,
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
  stravaEventUrl: true,
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
  directionsText: true,
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

    const { needsAdvance, expectedNextDateYmd } = computeLaneAdvanceState(
      latestPriorRun ? new Date(latestPriorRun.date) : null,
      futureOrToday.map((r) => new Date(r.date)),
      DEFAULT_ADVANCE_HORIZON_WEEKS,
      startOfToday
    );

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

async function duplicateRunForward(
  prior: Awaited<ReturnType<typeof fetchClubSeriesRuns>>[number],
  targetYmd: string,
  staffGeneratedId?: string | null,
  publishLive = false
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
    citySlug: prior.citySlug,
    slug: runSlug,
    runClubId: prior.runClubId,
    runSeriesId: prior.runSeriesId,
    staffGeneratedId: staffGeneratedId?.trim() || prior.staffGeneratedId || null,
    athleteGeneratedId: null,
    runCrewId: null,
    title,
    workflowStatus: publishLive ? "APPROVED" : "DEVELOP",
    published: publishLive,
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
    stravaEventUrl: null,
    stravaText: null,
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
    directionsText: prior.directionsText,
    routeId: prior.routeId,
    workoutId: prior.workoutId,
    cityRunType: prior.runClubId ? 'CLUB' : prior.cityRunType,
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

  try {
    const { cloneClubPlannedTemplateToRun } = await import(
      '@/lib/club-planned-workouts/clone-template-on-advance'
    );
    await cloneClubPlannedTemplateToRun(prior.id, created.id, targetDate);
  } catch (e) {
    console.warn('[advance-club-instances] planned template clone skipped', e);
  }

  return created;
}

/**
 * Product-first find-or-create: fill the next N weekly occurrence slots per runSeriesId lane.
 * Does not touch Company acq tables.
 */
export async function advanceClubInstances(opts: {
  runClubId: string;
  staffGeneratedId?: string | null;
  runSeriesIds?: string[];
  /** When true, new instances are APPROVED + published (MVP1 default). */
  publishLive?: boolean;
  horizonWeeks?: number;
}): Promise<AdvanceResult[]> {
  const {
    runClubId,
    staffGeneratedId,
    publishLive = true,
    horizonWeeks = DEFAULT_ADVANCE_HORIZON_WEEKS,
  } = opts;
  const filterIds =
    Array.isArray(opts.runSeriesIds) && opts.runSeriesIds.length > 0
      ? new Set(opts.runSeriesIds.map(String))
      : null;

  const runs = await fetchClubSeriesRuns(runClubId);
  const startOfToday = getStartOfTodayUTC();

  const bySeries = new Map<string, (typeof runs)[number][]>();
  for (const run of runs) {
    if (!run.runSeriesId) continue;
    if (filterIds && !filterIds.has(run.runSeriesId)) continue;
    const list = bySeries.get(run.runSeriesId) ?? [];
    list.push(run);
    bySeries.set(run.runSeriesId, list);
  }

  const results: AdvanceResult[] = [];

  for (const [runSeriesId, seriesRuns] of bySeries) {
    const historical = seriesRuns.filter((run) => run.date < startOfToday);
    if (historical.length === 0) {
      continue;
    }

    historical.sort((a, b) => b.date.getTime() - a.date.getTime());
    const latestPrior = historical[0];
    const futureOrToday = seriesRuns.filter((run) => run.date >= startOfToday);
    futureOrToday.sort((a, b) => b.date.getTime() - a.date.getTime());

    let template: (typeof runs)[number] = futureOrToday[0] ?? latestPrior;
    const horizonDates = getHorizonTargetDatesFromPrior(
      latestPrior.date,
      horizonWeeks,
      startOfToday
    );
    const existingYmds = new Set(seriesRuns.map((run) => dateToYmd(run.date)));

    for (const targetYmd of horizonDates) {
      try {
        if (existingYmds.has(targetYmd)) {
          const existing = await findRunOnDate(runClubId, runSeriesId, targetYmd);
          results.push({
            runSeriesId,
            priorRunId: template.id,
            targetDateYmd: targetYmd,
            outcome: "found_existing",
            runId: existing?.id,
          });
          continue;
        }

        const created = await duplicateRunForward(
          template,
          targetYmd,
          staffGeneratedId,
          publishLive
        );
        existingYmds.add(targetYmd);

        const fullCreated = await prisma.city_runs.findUnique({
          where: { id: created.id },
          select: CLUB_RUN_SELECT,
        });
        if (fullCreated) {
          template = fullCreated;
        }

        results.push({
          runSeriesId,
          priorRunId: latestPrior.id,
          targetDateYmd: targetYmd,
          outcome: "created",
          runId: created.id,
        });
      } catch (error: unknown) {
        const err = error as { message?: string };
        results.push({
          runSeriesId,
          priorRunId: latestPrior.id,
          targetDateYmd: targetYmd,
          outcome: "error",
          error: err?.message || "Failed to advance instance",
        });
      }
    }
  }

  if (filterIds) {
    for (const seriesId of filterIds) {
      const seriesRuns = bySeries.get(seriesId) ?? [];
      const hasPrior = seriesRuns.some((run) => run.date < startOfToday);
      if (!hasPrior) {
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
