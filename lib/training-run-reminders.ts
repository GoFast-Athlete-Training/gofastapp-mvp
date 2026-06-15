import { prisma } from '@/lib/prisma';
import { sendPushToAthlete } from '@/lib/push-notification';

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

function buildWorkoutReminderBody(title: string, distanceMi: string | null): string {
  if (distanceMi) return `Tomorrow: ${title} · ${distanceMi}`;
  return `Tomorrow: ${title}`;
}

export async function processTrainingRunReminders(now = new Date()) {
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = addUtcDays(todayStart, 1);
  const dayAfterTomorrow = addUtcDays(todayStart, 2);

  const [planWorkouts, scheduledRuns] = await Promise.all([
    prisma.workouts.findMany({
      where: {
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
    const distanceMi = formatDistanceMi(workout.estimatedDistanceInMeters);
    const body = buildWorkoutReminderBody(workout.title, distanceMi);
    const result = await sendPushToAthlete({
      athleteId: workout.athleteId,
      type: 'run_reminder',
      title: 'Your next run is coming',
      body,
      dedupeKey: `run_reminder:workout:${workout.id}:${tomorrowStart.toISOString().slice(0, 10)}`,
      deeplink: `/workouts/${workout.id}`,
      payload: { workoutId: workout.id, screen: 'workout', reminderKind: 'tomorrow' },
    });
    notificationsUpserted += 1;
    pushesSent += result.pushesSent;
  }

  for (const run of scheduledRuns) {
    const distancePart =
      run.estimatedDistanceMi != null
        ? `${run.estimatedDistanceMi.toFixed(1)} mi`
        : null;
    const timePart = run.startTimeLabel?.trim() || null;
    const detail = [distancePart, timePart].filter(Boolean).join(' · ');
    const body = detail ? `Tomorrow: ${run.title} · ${detail}` : `Tomorrow: ${run.title}`;

    const result = await sendPushToAthlete({
      athleteId: run.athleteId,
      type: 'run_reminder',
      title: 'Your next run is coming',
      body,
      dedupeKey: `run_reminder:scheduled:${run.id}:${tomorrowStart.toISOString().slice(0, 10)}`,
      deeplink: run.workoutId ? `/workouts/${run.workoutId}` : '/(tabs)/train',
      payload: {
        scheduledRunId: run.id,
        workoutId: run.workoutId,
        screen: run.workoutId ? 'workout' : 'train',
        reminderKind: 'tomorrow',
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
