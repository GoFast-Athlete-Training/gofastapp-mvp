import {
  isCityRunLiveForCheckin,
  isCityRunPast,
  isCityRunToday,
  isCityRunWithinPostRunCheckinWindow,
} from '@/lib/city-run-clock';
import { hasSocialRunLifecycle } from '@/lib/city-run-type';
import { localTodayKey, ymdFromDate } from '@/lib/training/plan-utils';
import { prisma } from '@/lib/prisma';
import { isHostRsvpRole } from '@/lib/city-run/rsvp-role';
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

/** Runner hub agenda — city run RSVPs only (training plan lives on Train). */
export async function fetchRunnerAgendaForAthlete(
  athleteId: string,
  opts?: { todayKey?: string; nowMs?: number }
): Promise<RunnerAgendaPayload> {
  const todayKey = opts?.todayKey ?? localTodayKey();
  const nowMs = opts?.nowMs ?? Date.now();

  const rsvps = await prisma.city_run_rsvps.findMany({
    where: {
      athleteId,
      status: { not: 'not-going' },
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
            where: { athleteId },
            select: { id: true, checkedInAt: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { city_runs: { date: 'asc' } },
    take: 40,
  });

  const attending = rsvps.filter((r) => isAttendingCityRunRsvp(r));

  const joinedRuns: RunnerJoinedRun[] = attending.map((r) => {
    const run = r.city_runs;
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
      rsvpRole: r.role ?? null,
      hasCheckin: Boolean(checkin),
      checkedInAt: checkin?.checkedInAt.toISOString() ?? null,
      isPast: isCityRunPast(clock, nowMs),
      isToday: isCityRunToday(clock, new Date(nowMs)),
      isLive: isCityRunLiveForCheckin(clock, nowMs),
      needsWereYouThere:
        !isHostRsvpRole(r.role) &&
        !checkin &&
        isCityRunPast(clock, nowMs) &&
        isCityRunWithinPostRunCheckinWindow(clock, nowMs),
      supportsCheckin: hasSocialRunLifecycle(run),
    };
  });

  const allItems = buildRunnerAgenda({
    todayKey,
    planSessions: [],
    joinedRuns,
  });

  const hostedItems: RunnerAgendaItem[] = [];
  const memberItems: RunnerAgendaItem[] = [];
  for (const item of allItems) {
    if (isHostRsvpRole(item.joinedRun?.rsvpRole)) {
      hostedItems.push(item);
    } else {
      memberItems.push(item);
    }
  }

  return {
    todayKey,
    hasActivePlan: false,
    hostedItems,
    memberItems,
    items: allItems,
  };
}
