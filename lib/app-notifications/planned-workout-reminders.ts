import { getEnabledDeviceTokens } from '@/lib/app-notifications/devices';
import { renderNotificationTemplate } from '@/lib/app-notifications/templates';
import { templateKeyToMobileType } from '@/lib/app-notifications/types';
import { sendExpoPushBatch } from '@/lib/expo-push';
import { prisma } from '@/lib/prisma';

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

export type PlannedWorkoutReminderResult = {
  workoutsConsidered: number;
  remindersSent: number;
  pushesSent: number;
  skippedNoToken: number;
  errors: number;
};

/**
 * Send tomorrow's planned workout reminders via Expo push.
 * State lives on workouts — no generic delivery rows.
 */
export async function sendPlannedWorkoutReminders(
  now = new Date()
): Promise<PlannedWorkoutReminderResult> {
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = addUtcDays(todayStart, 1);
  const dayAfterTomorrow = addUtcDays(todayStart, 2);

  const candidates = await prisma.workouts.findMany({
    where: {
      athleteId: { not: null },
      date: { gte: tomorrowStart, lt: dayAfterTomorrow },
      matchedActivityId: null,
      skippedAt: null,
      appnotificationReminderSentAt: null,
    },
    select: {
      id: true,
      athleteId: true,
      title: true,
      estimatedDistanceInMeters: true,
      scheduledStartTimeLabel: true,
      Athlete: { select: { firstName: true } },
    },
  });

  let remindersSent = 0;
  let pushesSent = 0;
  let skippedNoToken = 0;
  let errors = 0;

  for (const workout of candidates) {
    const athleteId = workout.athleteId;
    if (!athleteId) continue;

    const facts = {
      firstName: workout.Athlete?.firstName ?? 'there',
      workoutTitle: workout.title,
      distanceMi: formatDistanceMi(workout.estimatedDistanceInMeters),
    };

    const rendered = await renderNotificationTemplate('workout.tomorrow', facts);
    const tokens = await getEnabledDeviceTokens(athleteId);

    if (tokens.length === 0) {
      await prisma.workouts.update({
        where: { id: workout.id },
        data: { appnotificationReminderLastError: 'no_push_token' },
      });
      skippedNoToken++;
      continue;
    }

    const mobileType = templateKeyToMobileType('workout.tomorrow');
    const sentCount = await sendExpoPushBatch(tokens, {
      title: rendered.title,
      body: rendered.body,
      data: {
        workoutId: workout.id,
        type: mobileType,
        templateKey: 'workout.tomorrow',
        screen: 'workout',
        reminderKind: 'tomorrow',
        deeplink: `/workouts/${workout.id}`,
      },
    });

    if (sentCount > 0) {
      await prisma.workouts.update({
        where: { id: workout.id },
        data: {
          appnotificationReminderSentAt: now,
          appnotificationReminderLastError: null,
        },
      });
      remindersSent++;
      pushesSent += sentCount;
    } else {
      await prisma.workouts.update({
        where: { id: workout.id },
        data: { appnotificationReminderLastError: 'expo_push_failed' },
      });
      errors++;
    }
  }

  return {
    workoutsConsidered: candidates.length,
    remindersSent,
    pushesSent,
    skippedNoToken,
    errors,
  };
}
