import {
  isCityRunLiveForCheckin,
  isCityRunPast,
  isCityRunToday,
  isCityRunWithinPostRunCheckinWindow,
} from '@/lib/city-run-clock';
import { hasSocialRunLifecycle } from '@/lib/city-run-type';
import { localTodayKey, ymdFromDate } from '@/lib/training/plan-utils';
import { prisma } from '@/lib/prisma';

export type TodayRunPayload = {
  id: string;
  slug: string | null;
  title: string;
  date: string;
  dateKey: string;
  city: string | null;
  meetUpPoint: string;
  meetUpCity: string | null;
  meetUpState: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone: string | null;
  runClub: { slug: string; name: string; logoUrl: string | null } | null;
  runClubId: string | null;
  hasCheckin: boolean;
  checkedInAt: string | null;
  isPast: boolean;
  isToday: boolean;
  isLive: boolean;
  needsWereYouThere: boolean;
  supportsCheckin: boolean;
};

export type TodayRunsResponse = {
  todayKey: string;
  runs: TodayRunPayload[];
};

function mapRunClock(run: {
  date: Date;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone: string | null;
}) {
  return {
    date: run.date,
    startTimeHour: run.startTimeHour,
    startTimeMinute: run.startTimeMinute,
    startTimePeriod: run.startTimePeriod,
    timezone: run.timezone,
  };
}

function isTodayRunRelevant(
  clock: ReturnType<typeof mapRunClock>,
  nowMs: number,
  hasCheckin: boolean
): boolean {
  const today = isCityRunToday(clock, new Date(nowMs));
  const wereYouThere =
    !hasCheckin &&
    isCityRunPast(clock, nowMs) &&
    isCityRunWithinPostRunCheckinWindow(clock, nowMs);
  return today || wereYouThere;
}

/** Today-only joined city runs with check-in state — no training plan week. */
export async function fetchTodayRunsForAthlete(
  athleteId: string,
  opts?: { todayKey?: string; nowMs?: number }
): Promise<TodayRunsResponse> {
  const todayKey = opts?.todayKey ?? localTodayKey();
  const nowMs = opts?.nowMs ?? Date.now();
  const lookbackStart = new Date(nowMs - 24 * 60 * 60 * 1000);

  const rsvps = await prisma.city_run_rsvps.findMany({
    where: {
      athleteId,
      status: 'going',
      city_runs: {
        date: { gte: lookbackStart },
      },
    },
    include: {
      city_runs: {
        select: {
          id: true,
          slug: true,
          title: true,
          date: true,
          citySlug: true,
          cityRunType: true,
          meetUpPoint: true,
          meetUpCity: true,
          meetUpState: true,
          startTimeHour: true,
          startTimeMinute: true,
          startTimePeriod: true,
          timezone: true,
          runClubId: true,
          runClub: {
            select: { slug: true, name: true, logoUrl: true },
          },
          city_run_checkins: {
            where: { athleteId },
            select: { id: true, checkedInAt: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { city_runs: { date: 'asc' } },
    take: 20,
  });

  const runs: TodayRunPayload[] = [];

  for (const rsvp of rsvps) {
    const run = rsvp.city_runs;
    const clock = mapRunClock(run);
    const checkin = run.city_run_checkins[0] ?? null;
    const hasCheckin = Boolean(checkin);

    if (!isTodayRunRelevant(clock, nowMs, hasCheckin)) continue;

    runs.push({
      id: run.id,
      slug: run.slug,
      title: run.title,
      date: run.date.toISOString(),
      dateKey: ymdFromDate(run.date),
      city: run.citySlug,
      meetUpPoint: run.meetUpPoint,
      meetUpCity: run.meetUpCity,
      meetUpState: run.meetUpState,
      startTimeHour: run.startTimeHour,
      startTimeMinute: run.startTimeMinute,
      startTimePeriod: run.startTimePeriod,
      timezone: run.timezone,
      runClub: run.runClub,
      runClubId: run.runClubId,
      hasCheckin,
      checkedInAt: checkin?.checkedInAt.toISOString() ?? null,
      isPast: isCityRunPast(clock, nowMs),
      isToday: isCityRunToday(clock, new Date(nowMs)),
      isLive: isCityRunLiveForCheckin(clock, nowMs),
      needsWereYouThere:
        !hasCheckin &&
        isCityRunPast(clock, nowMs) &&
        isCityRunWithinPostRunCheckinWindow(clock, nowMs),
      supportsCheckin: hasSocialRunLifecycle(run),
    });
  }

  runs.sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    if (a.needsWereYouThere !== b.needsWereYouThere) return a.needsWereYouThere ? -1 : 1;
    if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
    return a.date.localeCompare(b.date);
  });

  return { todayKey, runs };
}
