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
  /** Legacy check-in row or planned_workouts.iRanAt */
  hasCheckin: boolean;
  checkedInAt: string | null;
  hasIRan: boolean;
  iRanAt: string | null;
  iRanDeclined: boolean;
  isPast: boolean;
  isToday: boolean;
  isLive: boolean;
  needsWereYouThere: boolean;
  supportsCheckin: boolean;
  /** Athlete RSVP role on this run (host vs joiner). */
  isHost: boolean;
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
  /** Host or joiner runs needing I-ran answer (no iRanAt, not declined). */
  needsYouRuns: TodayRunPayload[];
  /** Recent I-ran confirmations for shoe mini-feed. */
  doneRuns: TodayRunPayload[];
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
  athlete_stamp?: {
    iRanAt: Date | null;
    iRanDeclined: boolean;
  } | null;
  rsvpRole?: string | null;
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
  const stamp = run.athlete_stamp;
  const iRanAt = stamp?.iRanAt ?? null;
  const iRanDeclined = stamp?.iRanDeclined ?? false;
  const hasIRan = Boolean(iRanAt) || Boolean(checkin);
  const hasCheckin = hasIRan;
  const clock = mapRunClock(run);

  if (iRanDeclined) return null;

  if (!isTodayRunRelevant(clock, nowMs, hasCheckin) && !iRanAt) return null;

  const checkedInAtIso =
    iRanAt?.toISOString() ?? checkin?.checkedInAt.toISOString() ?? null;

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
    checkedInAt: checkedInAtIso,
    hasIRan,
    iRanAt: iRanAt?.toISOString() ?? null,
    iRanDeclined,
    isPast: isCityRunPast(clock, nowMs),
    isToday: isCityRunToday(clock, new Date(nowMs)),
    isLive: isCityRunLiveForCheckin(clock, nowMs),
    needsWereYouThere:
      !hasIRan &&
      !iRanDeclined &&
      isCityRunPast(clock, nowMs) &&
      isCityRunWithinPostRunCheckinWindow(clock, nowMs),
    supportsCheckin: hasSocialRunLifecycle(run),
    isHost: run.rsvpRole === RSVP_ROLE_HOST,
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

async function fetchAthleteStampByRunId(
  athleteId: string,
  runIds: string[]
): Promise<Map<string, { iRanAt: Date | null; iRanDeclined: boolean }>> {
  if (runIds.length === 0) return new Map();
  const stamps = await prisma.planned_workouts.findMany({
    where: { athleteId, cityRunId: { in: runIds } },
    select: { cityRunId: true, iRanAt: true, iRanDeclined: true },
  });
  const map = new Map<string, { iRanAt: Date | null; iRanDeclined: boolean }>();
  for (const s of stamps) {
    if (s.cityRunId) {
      map.set(s.cityRunId, { iRanAt: s.iRanAt, iRanDeclined: s.iRanDeclined });
    }
  }
  return map;
}

async function attachStampsToRuns(
  athleteId: string,
  runs: Array<Omit<RunSelectRow, 'athlete_stamp' | 'rsvpRole'>>
): Promise<RunSelectRow[]> {
  const runIds = runs.map((r) => r.id);
  const [stampMap, rsvpRows] = await Promise.all([
    fetchAthleteStampByRunId(athleteId, runIds),
    runIds.length > 0
      ? prisma.city_run_rsvps.findMany({
          where: { athleteId, runId: { in: runIds }, status: 'going' },
          select: { runId: true, role: true },
        })
      : Promise.resolve([]),
  ]);
  const roleMap = new Map(rsvpRows.map((r) => [r.runId, r.role]));
  return runs.map((run) => ({
    ...run,
    athlete_stamp: stampMap.get(run.id) ?? null,
    rsvpRole: roleMap.get(run.id) ?? null,
  }));
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
  const rawRuns = rsvps.map((r) => r.city_runs);
  const withStamps = await attachStampsToRuns(athleteId, rawRuns);
  for (const run of withStamps) {
    const mapped = mapRunToTodayPayload(run, athleteId, opts.nowMs);
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

  const [stampedRun] = planned.city_run
    ? await attachStampsToRuns(athleteId, [planned.city_run])
    : [null];

  const cityRunPayload = stampedRun
    ? mapRunToTodayPayload(stampedRun, athleteId, nowMs)
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

function dedupeRunsById(runs: TodayRunPayload[]): TodayRunPayload[] {
  const seen = new Set<string>();
  const out: TodayRunPayload[] = [];
  for (const run of runs) {
    if (seen.has(run.id)) continue;
    seen.add(run.id);
    out.push(run);
  }
  return out;
}

/** Closed out: declined, or past with I-ran evidence — drop from upcoming widgets. */
function isStackClosedOut(run: TodayRunPayload): boolean {
  return run.iRanDeclined || (run.hasIRan && run.isPast);
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

  const allGoing = going.runs;
  const allHosted = hosted.runs;
  const roster = dedupeRunsById([...allGoing, ...allHosted]);

  const needsYouRuns = roster.filter(
    (r) => r.needsWereYouThere && !r.hasIRan && !r.iRanDeclined
  );

  const goingRuns = allGoing.filter(
    (r) => !isStackClosedOut(r) && !r.needsWereYouThere
  );
  const hostedRuns = allHosted.filter(
    (r) => !isStackClosedOut(r) && !r.needsWereYouThere
  );

  const doneRuns = dedupeRunsById(
    roster.filter((r) => Boolean(r.iRanAt))
  ).sort((a, b) => (b.iRanAt ?? '').localeCompare(a.iRanAt ?? ''));

  return {
    todayKey,
    plannedRun,
    goingRuns,
    hostedRuns,
    needsYouRuns,
    doneRuns,
  };
}

/** @deprecated Alias for going-only check-in widget. */
export const fetchTodayRunsForAthlete = fetchTodayGoingRunsForAthlete;
