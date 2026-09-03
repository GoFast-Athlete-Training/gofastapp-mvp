import {
  isCityRunLiveForCheckin,
  isCityRunPast,
  isCityRunToday,
  isCityRunWithinPostRunCheckinWindow,
} from '@/lib/city-run-clock';
import { hasSocialRunLifecycle } from '@/lib/city-run-type';
import { buildPlanWeekCards, type PlanDayCard } from '@/lib/training/plan-week-cards';
import { planDayIsCompleted } from '@/lib/training/workout-has-actuals';
import {
  currentTrainingWeekNumber,
  effectiveTrainingWeekCount,
  localTodayKey,
  ymdFromDate,
} from '@/lib/training/plan-utils';
import { resolvePlanTerminalRaceDisplay } from '@/lib/training/plan-race-snapshots';
import { prisma } from '@/lib/prisma';
import { TrainingPlanLifecycle } from '@prisma/client';
import {
  buildRunnerAgenda,
  type RunnerAgendaPayload,
  type RunnerJoinedRun,
  type RunnerPlanSession,
  type RunnerPlannedWorkoutPreview,
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

function segmentPreview(
  segments: Array<{
    id: string;
    stepOrder: number;
    title: string;
    durationType: string;
    durationValue: number;
    repeatCount?: number | null;
  }>
): RunnerPlannedWorkoutPreview['segments'] {
  return segments.map((s) => ({
    id: s.id,
    stepOrder: s.stepOrder,
    title: s.title,
    durationType: s.durationType,
    durationValue: s.durationValue,
    repeatCount: s.repeatCount,
  }));
}

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

export async function fetchRunnerAgendaForAthlete(
  athleteId: string,
  opts?: { todayKey?: string; nowMs?: number }
): Promise<RunnerAgendaPayload> {
  const todayKey = opts?.todayKey ?? localTodayKey();
  const nowMs = opts?.nowMs ?? Date.now();
  const todayStart = new Date(`${todayKey}T00:00:00.000Z`);
  const horizonEnd = new Date(todayStart);
  horizonEnd.setUTCDate(horizonEnd.getUTCDate() + 21);

  const [rsvps, plan, stampRows] = await Promise.all([
    prisma.city_run_rsvps.findMany({
      where: { athleteId, status: 'going' },
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
            plannedWorkoutId: true,
            runClub: {
              select: { slug: true, name: true, logoUrl: true },
            },
            plannedWorkout: {
              select: {
                id: true,
                title: true,
                workoutType: true,
                segments: { orderBy: { stepOrder: 'asc' } },
              },
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
    }),
    prisma.training_plans.findFirst({
      where: { athleteId, lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
      orderBy: { updatedAt: 'desc' },
      include: {
        athlete_race: {
          select: {
            id: true,
            raceRegistryId: true,
            name: true,
            raceDate: true,
            distanceMeters: true,
            distanceLabel: true,
          },
        },
      },
    }),
    prisma.planned_workouts.findMany({
      where: {
        athleteId,
        cityRunId: { not: null },
        date: { gte: todayStart, lte: horizonEnd },
      },
      include: {
        segments: { orderBy: { stepOrder: 'asc' } },
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  const joinedRuns: RunnerJoinedRun[] = rsvps.map((r) => {
    const run = r.city_runs;
    const clock = mapRunClock(run);
    const checkin = run.city_run_checkins[0] ?? null;
    const dateKey = ymdFromDate(run.date);
    const template = run.plannedWorkout;
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
      plannedWorkoutId: run.plannedWorkoutId,
      plannedWorkoutPreview: template
        ? {
            id: template.id,
            title: template.title,
            workoutType: String(template.workoutType),
            segments: segmentPreview(template.segments),
          }
        : null,
      hasCheckin: Boolean(checkin),
      checkedInAt: checkin?.checkedInAt.toISOString() ?? null,
      isPast: isCityRunPast(clock, nowMs),
      isToday: isCityRunToday(clock, new Date(nowMs)),
      isLive: isCityRunLiveForCheckin(clock, nowMs),
      needsWereYouThere:
        !checkin &&
        isCityRunPast(clock, nowMs) &&
        isCityRunWithinPostRunCheckinWindow(clock, nowMs),
      supportsCheckin: hasSocialRunLifecycle(run),
    };
  });

  const planSessions: RunnerPlanSession[] = [];
  const stampByCityRunId = new Map(stampRows.map((s) => [s.cityRunId!, s]));

  if (plan?.planSchedule && plan.totalWeeks >= 1) {
    const terminal = resolvePlanTerminalRaceDisplay(plan);
    const raceDate = terminal?.raceDate ?? plan.athlete_race?.raceDate ?? null;
    const effectiveWeeks = effectiveTrainingWeekCount(
      plan.startDate,
      plan.totalWeeks,
      raceDate
    );
    const weekNum = currentTrainingWeekNumber(plan.startDate, effectiveWeeks, new Date(nowMs));

    const weekCards: PlanDayCard[] = await buildPlanWeekCards({
      planId: plan.id,
      athleteId,
      planStartDate: plan.startDate,
      planSchedule: plan.planSchedule,
      weekNumber: weekNum,
      storedTotalWeeks: plan.totalWeeks,
      raceDate,
      raceName: terminal?.name ?? plan.athlete_race?.name ?? null,
      raceDistanceMiles:
        plan.athlete_race?.distanceMeters != null
          ? plan.athlete_race.distanceMeters / 1609.34
          : null,
    });

    for (const card of weekCards) {
      if (card.dateKey < todayKey && !planDayIsCompleted(card)) continue;
      if (card.workoutType === 'Rest') continue;

      const stamp = card.plannedWorkoutId
        ? stampRows.find((s) => s.id === card.plannedWorkoutId)
        : null;

      planSessions.push({
        plannedWorkoutId: card.plannedWorkoutId,
        workoutId: card.workoutId,
        workoutCompleted: card.workoutCompleted,
        dateKey: card.dateKey,
        title: card.title,
        workoutType: card.workoutType,
        estimatedDistanceInMeters: card.estimatedDistanceInMeters || null,
        actualDistanceMeters: card.actualDistanceMeters ?? null,
        actualDurationSeconds: card.actualDurationSeconds ?? null,
        cityRunId: stamp?.cityRunId ?? null,
        plannedWorkoutPreview: stamp
          ? {
              id: stamp.id,
              title: stamp.title,
              workoutType: String(stamp.workoutType),
              segments: segmentPreview(stamp.segments),
            }
          : null,
      });
    }

    const futurePlanCount = planSessions.filter((p) => p.dateKey >= todayKey).length;
    if (futurePlanCount < 3 && weekNum < effectiveWeeks) {
      const nextWeekCards = await buildPlanWeekCards({
        planId: plan.id,
        athleteId,
        planStartDate: plan.startDate,
        planSchedule: plan.planSchedule,
        weekNumber: weekNum + 1,
        storedTotalWeeks: plan.totalWeeks,
        raceDate,
        raceName: terminal?.name ?? plan.athlete_race?.name ?? null,
        raceDistanceMiles:
          plan.athlete_race?.distanceMeters != null
            ? plan.athlete_race.distanceMeters / 1609.34
            : null,
      });
      for (const card of nextWeekCards) {
        if (card.dateKey < todayKey || card.workoutType === 'Rest') continue;
        if (planSessions.some((p) => p.dateKey === card.dateKey)) continue;
        const stamp = card.plannedWorkoutId
          ? stampRows.find((s) => s.id === card.plannedWorkoutId)
          : null;
        planSessions.push({
          plannedWorkoutId: card.plannedWorkoutId,
          workoutId: card.workoutId,
          workoutCompleted: card.workoutCompleted,
          dateKey: card.dateKey,
          title: card.title,
          workoutType: card.workoutType,
          estimatedDistanceInMeters: card.estimatedDistanceInMeters || null,
          actualDistanceMeters: card.actualDistanceMeters ?? null,
          actualDurationSeconds: card.actualDurationSeconds ?? null,
          cityRunId: stamp?.cityRunId ?? null,
          plannedWorkoutPreview: stamp
            ? {
                id: stamp.id,
                title: stamp.title,
                workoutType: String(stamp.workoutType),
                segments: segmentPreview(stamp.segments),
              }
            : null,
        });
      }
    }
  }

  for (const stamp of stampRows) {
    if (!stamp.cityRunId) continue;
    const dateKey = ymdFromDate(stamp.date);
    if (planSessions.some((p) => p.plannedWorkoutId === stamp.id || p.cityRunId === stamp.cityRunId)) {
      continue;
    }
    planSessions.push({
      plannedWorkoutId: stamp.id,
      workoutId: null,
      workoutCompleted: false,
      dateKey,
      title: stamp.title,
      workoutType: String(stamp.workoutType),
      estimatedDistanceInMeters: stamp.estimatedDistanceInMeters,
      actualDistanceMeters: null,
      actualDurationSeconds: null,
      cityRunId: stamp.cityRunId,
      plannedWorkoutPreview: {
        id: stamp.id,
        title: stamp.title,
        workoutType: String(stamp.workoutType),
        segments: segmentPreview(stamp.segments),
      },
    });
  }

  for (const run of joinedRuns) {
    if (run.plannedWorkoutPreview) continue;
    const stamp = stampByCityRunId.get(run.id);
    if (!stamp) continue;
    run.plannedWorkoutPreview = {
      id: stamp.id,
      title: stamp.title,
      workoutType: String(stamp.workoutType),
      segments: segmentPreview(stamp.segments),
    };
  }

  const items = buildRunnerAgenda({
    todayKey,
    planSessions,
    joinedRuns,
  });

  return {
    todayKey,
    hasActivePlan: Boolean(plan),
    items,
  };
}
