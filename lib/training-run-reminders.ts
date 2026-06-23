import { prisma } from '@/lib/prisma';
import { sendAppNotification } from '@/lib/app-notifications/send';

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDistanceMi(meters: number | null | undefined): string | null {
  if (meters == null || meters <= 0) return null;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

export async function processTrainingRunReminders(now = new Date()) {
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = addUtcDays(todayStart, 1);
  const dayAfterTomorrow = addUtcDays(todayStart, 2);

  const [planWorkouts, scheduledRuns] = await Promise.all([
    prisma.workouts.findMany({
      where: {
        athleteId: { not: null },
        date: { gte: tomorrowStart, lt: dayAfterTomorrow },
        matchedActivityId: null,
        skippedAt: null,
        training_plans: { lifecycleStatus: 'ACTIVE' },
      },
      select: {
        id: true,
        athleteId: true,
        title: true,
        estimatedDistanceInMeters: true,
        Athlete: { select: { firstName: true } },
      },
    }),
    prisma.scheduled_runs.findMany({
      where: {
        date: { gte: tomorrowStart, lt: dayAfterTomorrow },
      },
      select: {
        id: true,
        athleteId: true,
        workoutId: true,
        title: true,
        estimatedDistanceMi: true,
        startTimeLabel: true,
      },
    }),
  ]);

  let notificationsUpserted = 0;
  let pushesSent = 0;

  for (const workout of planWorkouts) {
    const athleteId = workout.athleteId;
    if (!athleteId) continue;

    const distanceMi = formatDistanceMi(workout.estimatedDistanceInMeters);
    const result = await sendAppNotification({
      athleteId,
      templateKey: 'workout.tomorrow',
      objectType: 'workout',
      objectId: workout.id,
      deeplink: `/workouts/${workout.id}`,
      payload: { workoutId: workout.id, screen: 'workout', reminderKind: 'tomorrow' },
      facts: {
        firstName: workout.Athlete?.firstName ?? 'there',
        workoutTitle: workout.title,
        distanceMi,
      },
    });
    notificationsUpserted += 1;
    pushesSent += result.pushesSent;
  }

  for (const run of scheduledRuns) {
    const distancePart =
      run.estimatedDistanceMi != null ? `${run.estimatedDistanceMi.toFixed(1)} mi` : null;
    const timePart = run.startTimeLabel?.trim() || null;
    const detail = [distancePart, timePart].filter(Boolean).join(' · ');

    const result = await sendAppNotification({
      athleteId: run.athleteId,
      templateKey: 'scheduledRun.tomorrow',
      objectType: 'scheduled_run',
      objectId: run.id,
      deeplink: run.workoutId ? `/workouts/${run.workoutId}` : '/(tabs)/train',
      payload: {
        scheduledRunId: run.id,
        workoutId: run.workoutId,
        screen: run.workoutId ? 'workout' : 'train',
        reminderKind: 'tomorrow',
      },
      facts: {
        runTitle: run.title,
        detail: detail || undefined,
      },
    });
    notificationsUpserted += 1;
    pushesSent += result.pushesSent;
  }

  return {
    notificationsUpserted,
    pushesSent,
    planWorkouts: planWorkouts.length,
    scheduledRuns: scheduledRuns.length,
  };
}
