import {
  computeLaneAdvanceState,
  getStartOfTodayUTC,
  type RunInstanceSummary,
} from "@/lib/advance-club-instances";
import { prisma } from "@/lib/prisma";
import { localCalendarYmd } from "@/lib/date-local";
import { compareSeriesByWeekdayTime } from "@/lib/runmanage/sort-series-by-weekday";

const WEEKDAY_TO_JS: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

export type SeriesStoplight = "ready" | "build_next" | "build_first";

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
  stoplight: SeriesStoplight;
  nextRun: RunInstanceSummary | null;
  latestPriorRun: RunInstanceSummary | null;
  expectedNextDateYmd: string | null;
  suggestedBuildDateYmd: string | null;
  runCount: number;
};

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

export async function buildOperationalSeriesList(opts?: {
  runClubId?: string | null;
}): Promise<OperationalSeriesRow[]> {
  const runClubId = opts?.runClubId?.trim() || null;
  const startOfToday = getStartOfTodayUTC();

  const seriesRows = await prisma.run_series.findMany({
    where: runClubId ? { runClubId } : {},
    orderBy: [{ runClubId: "asc" }, { dayOfWeek: "asc" }, { name: "asc" }],
    include: {
      runClub: {
        select: { id: true, name: true, city: true },
      },
      _count: { select: { city_runs: true } },
    },
  });

  const runs = await prisma.city_runs.findMany({
    where: {
      runSeriesId: { not: null },
      ...(runClubId ? { runClubId } : {}),
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
      futureOrToday.map((r) => new Date(r.date))
    );

    let stoplight: SeriesStoplight = "ready";
    let suggestedBuildDateYmd: string | null = null;

    if (nextRun) {
      stoplight = "ready";
    } else if (seriesRuns.length === 0) {
      stoplight = "build_first";
      suggestedBuildDateYmd = nextYmdForDayOfWeek(s.dayOfWeek);
    } else if (needsAdvance) {
      stoplight = "build_next";
      suggestedBuildDateYmd = expectedNextDateYmd;
    } else {
      stoplight = "build_next";
      suggestedBuildDateYmd =
        expectedNextDateYmd ?? nextYmdForDayOfWeek(s.dayOfWeek);
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
      stoplight,
      nextRun,
      latestPriorRun,
      expectedNextDateYmd,
      suggestedBuildDateYmd,
      runCount: s._count.city_runs,
    });
  }

  rows.sort((a, b) => compareSeriesByWeekdayTime(a, b));

  return rows;
}
