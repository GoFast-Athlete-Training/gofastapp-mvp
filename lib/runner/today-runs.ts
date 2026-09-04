import {
  isCityRunLiveForCheckin,
  isCityRunPast,
  isCityRunToday,
  isCityRunWithinPostRunCheckinWindow,
} from '@/lib/city-run-clock';
import { RSVP_ROLE_GOING, RSVP_ROLE_HOST } from '@/lib/city-run/rsvp-role';
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

export type TodayPlannedRunPayload = {
  plannedWorkoutId: string;
  title: string;
  workoutType: string;
  cityRunId: string | null;
  estimatedDistanceInMeters: number | null;
  cityRun: TodayRunPayload | null;
};

export type MyDayResponse = {
  todayKey: string;
  plannedRun: TodayPlannedRunPayload | null;
  goingRuns: TodayRunPayload[];
  hostedRuns: TodayRunPayload[];
};

type RunClockInput = {
  date: Date;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone: string | null;
};

type RunSelectRow = {
  id: string;
  slug: string | null;
  title: string;
  date: Date;
  citySlug: string | null;
  cityRunType: string | null;
  meetUpPoint: string;
  meetUpCity: string | null;
  meetUpState: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone: string | null;
  runClubId: string | null;
  runClub: { slug: string; name: string; logoUrl: string | null } | null;
  city_run_checkins: Array<{ id: string; checkedInAt: Date }>;
};

const RUN_SELECT = {
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
    select: { id: true, checkedInAt: true },
  },
} as const;

function mapRunClock(run: RunClockInput) {
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

function mapRunToTodayPayload(
  run: RunSelectRow,
  athleteId: string,
  nowMs: number
): TodayRunPayload | null {
  const checkin =
    run.city_run_checkins.find((row) => row.checkedInAt) ??
    run.city_run_checkins[0] ??
    null;
  const hasCheckin = Boolean(checkin);
  const clock = mapRunClock(run);

  if (!isTodayRunRelevant(clock, nowMs, hasCheckin)) return null;

  return {
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
  };
}

function sortTodayRuns(runs: TodayRunPayload[]): TodayRunPayload[] {
  return [...runs].sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    if (a.needsWereYouThere !== b.needsWereYouThere) return a.needsWereYouThere ? -1 : 1;
    if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
    return a.date.localeCompare(b.date);
  });
}

function utcStartOfDayFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function utcNextDayStartFromKey(dateKey: string): Date {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

async function fetchRsvpRunsForRole(
  athleteId: string,
  role: typeof RSVP_ROLE_GOING | typeof RSVP_ROLE_HOST,
  opts: { todayKey: string; nowMs: number }
): Promise<TodayRunPayload[]> {
  const lookbackStart = new Date(opts.nowMs - 24 * 60 * 60 * 1000);

  const rsvps = await prisma.city_run_rsvps.findMany({
    where: {
      athleteId,
      status: 'going',
      role,
      city_runs: {
        date: { gte: lookbackStart },
      },
    },
    include: {
      city_runs: {
        select: {
          ...RUN_SELECT,
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
    const mapped = mapRunToTodayPayload(rsvp.city_runs, athleteId, opts.nowMs);
    if (mapped) runs.push(mapped);
  }

  return sortTodayRuns(runs);
}

/** Today's plan day with optional stamped city run (planned widget). */
export async function fetchTodayPlannedRunForAthlete(
  athleteId: string,
  opts?: { todayKey?: string; nowMs?: number }
): Promise<TodayPlannedRunPayload | null> {
  const todayKey = opts?.todayKey ?? localTodayKey();
  const nowMs = opts?.nowMs ?? Date.now();
  const dayStart = utcStartOfDayFromKey(todayKey);
  const dayEnd = utcNextDayStartFromKey(todayKey);

  const plan = await prisma.training_plans.findFirst({
    where: { athleteId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  if (!plan) return null;

  const planned = await prisma.planned_workouts.findFirst({
    where: {
      athleteId,
      planId: plan.id,
      date: { gte: dayStart, lt: dayEnd },
    },
    select: {
      id: true,
      title: true,
      workoutType: true,
      cityRunId: true,
      estimatedDistanceInMeters: true,
      city_run: {
        select: {
          ...RUN_SELECT,
          city_run_checkins: {
            where: { athleteId },
            select: { id: true, checkedInAt: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!planned) return null;

  const cityRunPayload = planned.city_run
    ? mapRunToTodayPayload(planned.city_run, athleteId, nowMs)
    : null;

  return {
    plannedWorkoutId: planned.id,
    title: planned.title,
    workoutType: planned.workoutType,
    cityRunId: planned.cityRunId,
    estimatedDistanceInMeters: planned.estimatedDistanceInMeters,
    cityRun: cityRunPayload,
  };
}

/** Check-in widget — junction role going only. */
export async function fetchTodayGoingRunsForAthlete(
  athleteId: string,
  opts?: { todayKey?: string; nowMs?: number }
): Promise<TodayRunsResponse> {
  const todayKey = opts?.todayKey ?? localTodayKey();
  const nowMs = opts?.nowMs ?? Date.now();
  const runs = await fetchRsvpRunsForRole(athleteId, RSVP_ROLE_GOING, { todayKey, nowMs });
  return { todayKey, runs };
}

/** Hosted widget — junction role host. */
export async function fetchTodayHostedRunsForAthlete(
  athleteId: string,
  opts?: { todayKey?: string; nowMs?: number }
): Promise<TodayRunsResponse> {
  const todayKey = opts?.todayKey ?? localTodayKey();
  const nowMs = opts?.nowMs ?? Date.now();
  const runs = await fetchRsvpRunsForRole(athleteId, RSVP_ROLE_HOST, { todayKey, nowMs });
  return { todayKey, runs };
}

/** MyDay card — three widgets, not merged. */
export async function fetchMyDayForAthlete(
  athleteId: string,
  opts?: { todayKey?: string; nowMs?: number }
): Promise<MyDayResponse> {
  const todayKey = opts?.todayKey ?? localTodayKey();
  const nowMs = opts?.nowMs ?? Date.now();
  const shared = { todayKey, nowMs };

  const [plannedRun, going, hosted] = await Promise.all([
    fetchTodayPlannedRunForAthlete(athleteId, shared),
    fetchTodayGoingRunsForAthlete(athleteId, shared),
    fetchTodayHostedRunsForAthlete(athleteId, shared),
  ]);

  return {
    todayKey,
    plannedRun,
    goingRuns: going.runs,
    hostedRuns: hosted.runs,
  };
}

/** @deprecated Alias for going-only check-in widget. */
export const fetchTodayRunsForAthlete = fetchTodayGoingRunsForAthlete;
