import { getStartOfTodayUTC, type RunInstanceSummary } from "@/lib/advance-club-instances";
import { dateKeyFromDate } from "@/lib/calendar-date";
import { prisma } from "@/lib/prisma";
import { localCalendarYmd } from "@/lib/date-local";
import { compareSeriesByWeekdayTime } from "@/lib/runmanage/sort-series-by-weekday";
import {
  weekWindowContaining,
  ymdForDayInWeek,
  type WeekWindow,
} from "@/lib/runmanage/calendar-week";

const WEEKDAY_TO_JS: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

export type SeriesStoplight = "ready" | "needs_validate" | "needs_prepare" | "build_first";

/** @deprecated legacy alias */
export type LegacySeriesStoplight = "ready" | "build_next" | "build_first";

export type WeekRunSummary = RunInstanceSummary & {
  dateValidate: boolean;
  timeValidate: boolean;
  meetupValidate: boolean;
  routeId: string | null;
  meetUpPoint: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
};

export type OperationalSeriesRow = {
  seriesId: string;
  slug: string | null;
  name: string | null;
  dayOfWeek: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  meetUpPoint: string | null;
  runClubId: string | null;
  clubName: string | null;
  clubCity: string | null;
  regionSlug: string | null;
  citySlug: string | null;
  stoplight: SeriesStoplight;
  weekSlotYmd: string | null;
  weekRun: WeekRunSummary | null;
  validationReady: boolean;
  /** Same as weekRun when in week board mode (compat). */
  nextRun: RunInstanceSummary | null;
  latestPriorRun: RunInstanceSummary | null;
  expectedNextDateYmd: string | null;
  suggestedBuildDateYmd: string | null;
  runCount: number;
};

function mapWeekRunSummary(run: {
  id: string;
  title: string;
  date: Date;
  published: boolean;
  workflowStatus: string;
  runSeriesId: string | null;
  runClubId: string | null;
  dateValidate: boolean;
  timeValidate: boolean;
  meetupValidate: boolean;
  routeId: string | null;
  meetUpPoint: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
}): WeekRunSummary | null {
  if (!run.runSeriesId) return null;
  return {
    id: run.id,
    title: run.title,
    date: run.date.toISOString(),
    published: run.published,
    workflowStatus: run.workflowStatus,
    runSeriesId: run.runSeriesId,
    runClubId: run.runClubId,
    dateValidate: run.dateValidate,
    timeValidate: run.timeValidate,
    meetupValidate: run.meetupValidate,
    routeId: run.routeId,
    meetUpPoint: run.meetUpPoint,
    startTimeHour: run.startTimeHour,
    startTimeMinute: run.startTimeMinute,
    startTimePeriod: run.startTimePeriod,
  };
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

/** Next calendar date (local) on or after today matching canonical dayOfWeek. */
export function nextYmdForDayOfWeek(dayOfWeek: string, from = new Date()): string | null {
  const target = WEEKDAY_TO_JS[dayOfWeek.trim().toUpperCase()];
  if (target === undefined) return null;
  const cursor = new Date(from);
  cursor.setHours(12, 0, 0, 0);
  for (let i = 0; i < 8; i++) {
    if (cursor.getDay() === target) {
      return localCalendarYmd(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

const RUN_SELECT = {
  id: true,
  title: true,
  date: true,
  published: true,
  workflowStatus: true,
  runSeriesId: true,
  runClubId: true,
  dateValidate: true,
  timeValidate: true,
  meetupValidate: true,
  routeId: true,
  meetUpPoint: true,
  startTimeHour: true,
  startTimeMinute: true,
  startTimePeriod: true,
} as const;

export async function buildWeekBoardSeriesList(opts: {
  regionSlug: string;
  citySlug: string;
  weekOffset?: number;
  runClubId?: string | null;
}): Promise<{ window: WeekWindow; series: OperationalSeriesRow[] }> {
  const regionSlug = opts.regionSlug.trim();
  const citySlug = opts.citySlug.trim();
  const runClubId = opts.runClubId?.trim() || null;
  const window = weekWindowContaining(new Date(), opts.weekOffset ?? 0);
  const startOfToday = getStartOfTodayUTC();

  const city = await prisma.cities.findFirst({
    where: { slug: citySlug, region: { slug: regionSlug } },
    select: { id: true, slug: true },
  });
  if (!city) {
    return { window, series: [] };
  }

  const seriesRows = await prisma.run_series.findMany({
    where: {
      OR: [{ citySlug: city.slug }, { cityId: city.id }],
      ...(runClubId ? { runClubId } : {}),
    },
    orderBy: [{ dayOfWeek: "asc" }, { name: "asc" }],
    include: {
      runClub: { select: { id: true, name: true, city: true } },
      cities: { select: { slug: true, region: { select: { slug: true } } } },
      _count: { select: { city_runs: true } },
    },
  });

  const seriesIds = seriesRows.map((s) => s.id);
  const runs =
    seriesIds.length === 0
      ? []
      : await prisma.city_runs.findMany({
          where: { runSeriesId: { in: seriesIds } },
          select: RUN_SELECT,
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        });

  const bySeries = new Map<string, (typeof runs)[number][]>();
  for (const run of runs) {
    if (!run.runSeriesId) continue;
    const list = bySeries.get(run.runSeriesId) ?? [];
    list.push(run);
    bySeries.set(run.runSeriesId, list);
  }

  const rows: OperationalSeriesRow[] = [];

  for (const s of seriesRows) {
    const seriesRuns = bySeries.get(s.id) ?? [];
    const weekSlotYmd = ymdForDayInWeek(s.dayOfWeek, window);

    const weekRunRaw = weekSlotYmd
      ? seriesRuns.find((r) => dateKeyFromDate(r.date) === weekSlotYmd)
      : undefined;
    const weekRun = weekRunRaw ? mapWeekRunSummary(weekRunRaw) : null;

    const historical = seriesRuns.filter((r) => r.date < startOfToday);
    historical.sort((a, b) => b.date.getTime() - a.date.getTime());
    const latestPriorRun = historical[0] ? mapRunSummary(historical[0]) : null;

    const validationReady = Boolean(
      weekRun?.dateValidate && weekRun?.timeValidate && weekRun?.meetupValidate
    );

    let stoplight: SeriesStoplight = "build_first";
    if (weekRun) {
      stoplight = validationReady ? "ready" : "needs_validate";
    } else if (latestPriorRun) {
      stoplight = "needs_prepare";
    } else if (seriesRuns.length === 0) {
      stoplight = "build_first";
    }

    rows.push({
      seriesId: s.id,
      slug: s.slug,
      name: s.name,
      dayOfWeek: s.dayOfWeek,
      startTimeHour: s.startTimeHour,
      startTimeMinute: s.startTimeMinute,
      startTimePeriod: s.startTimePeriod,
      meetUpPoint: s.meetUpPoint,
      runClubId: s.runClubId,
      clubName: s.runClub?.name ?? null,
      clubCity: s.runClub?.city ?? null,
      regionSlug: s.cities?.region?.slug ?? regionSlug,
      citySlug: s.citySlug ?? s.cities?.slug ?? city.slug,
      stoplight,
      weekSlotYmd,
      weekRun,
      validationReady,
      nextRun: weekRun,
      latestPriorRun,
      expectedNextDateYmd: weekSlotYmd,
      suggestedBuildDateYmd: weekSlotYmd ?? nextYmdForDayOfWeek(s.dayOfWeek),
      runCount: s._count.city_runs,
    });
  }

  rows.sort((a, b) => compareSeriesByWeekdayTime(a, b));
  return { window, series: rows };
}

/** @deprecated Use buildWeekBoardSeriesList for Run Manage board. Kept for narrow club-scoped callers. */
export async function buildOperationalSeriesList(opts?: {
  runClubId?: string | null;
}): Promise<OperationalSeriesRow[]> {
  const runClubId = opts?.runClubId?.trim() || null;
  const startOfToday = getStartOfTodayUTC();
  const window = weekWindowContaining(new Date(), 0);

  const seriesRows = await prisma.run_series.findMany({
    where: runClubId ? { runClubId } : {},
    orderBy: [{ runClubId: "asc" }, { dayOfWeek: "asc" }, { name: "asc" }],
    include: {
      runClub: { select: { id: true, name: true, city: true } },
      _count: { select: { city_runs: true } },
    },
  });

  const runs = await prisma.city_runs.findMany({
    where: {
      runSeriesId: { not: null },
      ...(runClubId ? { runClubId } : {}),
    },
    select: RUN_SELECT,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const bySeries = new Map<string, typeof runs>();
  for (const run of runs) {
    if (!run.runSeriesId) continue;
    const list = bySeries.get(run.runSeriesId) ?? [];
    list.push(run);
    bySeries.set(run.runSeriesId, list);
  }

  const rows: OperationalSeriesRow[] = [];

  for (const s of seriesRows) {
    const seriesRuns = bySeries.get(s.id) ?? [];
    const weekSlotYmd = ymdForDayInWeek(s.dayOfWeek, window);
    const weekRunRaw = weekSlotYmd
      ? seriesRuns.find((r) => dateKeyFromDate(r.date) === weekSlotYmd)
      : undefined;
    const weekRun = weekRunRaw ? mapWeekRunSummary(weekRunRaw) : null;

    const historical = seriesRuns.filter((r) => r.date < startOfToday);
    historical.sort((a, b) => b.date.getTime() - a.date.getTime());
    const latestPriorRun = historical[0] ? mapRunSummary(historical[0]) : null;

    const validationReady = Boolean(
      weekRun?.dateValidate && weekRun?.timeValidate && weekRun?.meetupValidate
    );

    let stoplight: SeriesStoplight = "build_first";
    if (weekRun) {
      stoplight = validationReady ? "ready" : "needs_validate";
    } else if (latestPriorRun) {
      stoplight = "needs_prepare";
    }

    rows.push({
      seriesId: s.id,
      slug: s.slug,
      name: s.name,
      dayOfWeek: s.dayOfWeek,
      startTimeHour: s.startTimeHour,
      startTimeMinute: s.startTimeMinute,
      startTimePeriod: s.startTimePeriod,
      meetUpPoint: s.meetUpPoint,
      runClubId: s.runClubId,
      clubName: s.runClub?.name ?? null,
      clubCity: s.runClub?.city ?? null,
      regionSlug: null,
      citySlug: s.citySlug,
      stoplight,
      weekSlotYmd,
      weekRun,
      validationReady,
      nextRun: weekRun,
      latestPriorRun,
      expectedNextDateYmd: weekSlotYmd,
      suggestedBuildDateYmd: weekSlotYmd ?? nextYmdForDayOfWeek(s.dayOfWeek),
      runCount: s._count.city_runs,
    });
  }

  rows.sort((a, b) => compareSeriesByWeekdayTime(a, b));
  return rows;
}
