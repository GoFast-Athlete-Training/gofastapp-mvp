import {
  isCityRunLiveForCheckin,
  isCityRunPast,
  isCityRunToday,
} from '@/lib/city-run-clock';
import { hasSocialRunLifecycle } from '@/lib/city-run-type';
import { localTodayKey, ymdFromDate } from '@/lib/training/plan-utils';
import { prisma } from '@/lib/prisma';
import { isHostRsvpRole, RSVP_ROLE_HOST } from '@/lib/city-run/rsvp-role';
import { isAttendingCityRunRsvp } from '@/lib/city-run/rsvp-attendance';
import {
  buildRunnerAgenda,
  type RunnerAgendaItem,
  type RunnerAgendaPayload,
  type RunnerJoinedRun,
} from '@/lib/runner/build-runner-agenda';

export type {
  RunnerAgendaItem,
  RunnerAgendaItemKind,
  RunnerAgendaPayload,
  RunnerJoinedRun,
  RunnerPlanSession,
  RunnerPlannedWorkoutPreview,
} from '@/lib/runner/build-runner-agenda';

export { buildRunnerAgenda };

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

const cityRunSelect = {
  id: true,
  slug: true,
  title: true,
  date: true,
  citySlug: true,
  cityRunType: true,
  meetUpPoint: true,
  meetUpCity: true,
  meetUpState: true,
  totalMiles: true,
  pace: true,
  workoutDescription: true,
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

function mapCityRunToJoinedRun(
  run: {
    id: string;
    slug: string | null;
    title: string;
    date: Date;
    citySlug: string | null;
    cityRunType: string | null;
    meetUpPoint: string;
    meetUpCity: string | null;
    meetUpState: string | null;
    totalMiles: number | null;
    pace: string | null;
    workoutDescription: string | null;
    startTimeHour: number | null;
    startTimeMinute: number | null;
    startTimePeriod: string | null;
    timezone: string | null;
    runClubId: string | null;
    runClub: { slug: string; name: string; logoUrl: string | null } | null;
    city_run_checkins: Array<{ id: string; checkedInAt: Date }>;
  },
  rsvpRole: string | null,
  nowMs: number,
): RunnerJoinedRun {
  const clock = mapRunClock(run);
  const checkin = run.city_run_checkins[0] ?? null;
  const dateKey = ymdFromDate(run.date);
  return {
    id: run.id,
    slug: run.slug,
    title: run.title,
    date: run.date.toISOString(),
    dateKey,
    city: run.citySlug,
    cityRunType: run.cityRunType,
    meetUpPoint: run.meetUpPoint,
    meetUpCity: run.meetUpCity,
    meetUpState: run.meetUpState,
    totalMiles: run.totalMiles,
    pace: run.pace,
    workoutDescription: run.workoutDescription,
    startTimeHour: run.startTimeHour,
    startTimeMinute: run.startTimeMinute,
    startTimePeriod: run.startTimePeriod,
    timezone: run.timezone,
    runClub: run.runClub,
    runClubId: run.runClubId,
    plannedWorkoutId: null,
    plannedWorkoutPreview: null,
    rsvpRole,
    hasCheckin: Boolean(checkin),
    checkedInAt: checkin?.checkedInAt.toISOString() ?? null,
    isPast: isCityRunPast(clock, nowMs),
    isToday: isCityRunToday(clock, new Date(nowMs)),
    isLive: isCityRunLiveForCheckin(clock, nowMs),
    needsWereYouThere: false,
    supportsCheckin: hasSocialRunLifecycle(run),
  };
}

function joinedRunToAgendaItem(run: RunnerJoinedRun): RunnerAgendaItem {
  return {
    id: `run:${run.id}`,
    dateKey: run.dateKey,
    kind: 'joined-run-only',
    isToday: run.isToday,
    sortPriority: run.isToday ? 0 : run.dateKey < localTodayKey() ? 3 : 4,
    plan: null,
    joinedRun: run,
  };
}

/** Runner hub agenda — city runs created or signed up (role lookup). */
export async function fetchRunnerAgendaForAthlete(
  athleteId: string,
  opts?: { todayKey?: string; nowMs?: number },
): Promise<RunnerAgendaPayload> {
  const todayKey = opts?.todayKey ?? localTodayKey();
  const nowMs = opts?.nowMs ?? Date.now();

  const rsvps = await prisma.city_run_rsvps.findMany({
    where: { athleteId },
    include: {
      city_runs: {
        select: {
          ...cityRunSelect,
          city_run_checkins: {
            where: { athleteId },
            select: { id: true, checkedInAt: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { city_runs: { date: 'asc' } },
    take: 80,
  });

  const onRunRsvps = rsvps.filter((r) => isAttendingCityRunRsvp(r));
  const rsvpRunIds = new Set(onRunRsvps.map((r) => r.runId));

  const createdWithoutRsvp = await prisma.city_runs.findMany({
    where: {
      athleteGeneratedId: athleteId,
      id: { notIn: [...rsvpRunIds] },
    },
    select: {
      ...cityRunSelect,
      city_run_checkins: {
        where: { athleteId },
        select: { id: true, checkedInAt: true },
        take: 1,
      },
    },
    orderBy: { date: 'asc' },
    take: 40,
  });

  const joinedRuns: RunnerJoinedRun[] = [
    ...onRunRsvps.map((r) =>
      mapCityRunToJoinedRun(r.city_runs, r.role ?? null, nowMs),
    ),
    ...createdWithoutRsvp.map((run) =>
      mapCityRunToJoinedRun(run, RSVP_ROLE_HOST, nowMs),
    ),
  ];

  const byId = new Map<string, RunnerJoinedRun>();
  for (const run of joinedRuns) {
    byId.set(run.id, run);
  }
  const deduped = [...byId.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const upcomingRuns = deduped.filter((run) => run.dateKey >= todayKey);
  const pastRuns = deduped
    .filter((run) => run.dateKey < todayKey)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  const allItems = upcomingRuns.map((run) => joinedRunToAgendaItem(run));

  const hostedItems: RunnerAgendaItem[] = [];
  const memberItems: RunnerAgendaItem[] = [];
  for (const item of allItems) {
    if (isHostRsvpRole(item.joinedRun?.rsvpRole)) {
      hostedItems.push(item);
    } else {
      memberItems.push(item);
    }
  }

  const pastItems = pastRuns.map((run) => joinedRunToAgendaItem(run));

  return {
    todayKey,
    hasActivePlan: false,
    hostedItems,
    memberItems,
    items: allItems,
    pastItems,
  };
}
