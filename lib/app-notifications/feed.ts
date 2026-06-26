import { loadNotificationFacts } from '@/lib/app-notifications/facts';
import { renderNotificationTemplate } from '@/lib/app-notifications/templates';
import {
  templateKeyToMobileType,
  type AppNotificationFeedRow,
  type NotificationTemplateKey,
} from '@/lib/app-notifications/types';
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

/**
 * Derived in-app feed from workouts with sent reminders (no delivery table).
 */
export async function getAppNotificationFeed(params: {
  athleteId: string;
  unreadOnly?: boolean;
  take?: number;
}): Promise<AppNotificationFeedRow[]> {
  const take = params.take ?? 30;
  const now = new Date();
  const tomorrowStart = addUtcDays(startOfUtcDay(now), 1);
  const dayAfterTomorrow = addUtcDays(startOfUtcDay(now), 2);

  const workouts = await prisma.workouts.findMany({
    where: {
      athleteId: params.athleteId,
      appnotificationReminderSentAt: { not: null },
      ...(params.unreadOnly ? { appnotificationReminderDeliveredAt: null } : {}),
    },
    orderBy: { appnotificationReminderSentAt: 'desc' },
    take,
    select: {
      id: true,
      title: true,
      date: true,
      estimatedDistanceInMeters: true,
      appnotificationReminderSentAt: true,
      appnotificationReminderDeliveredAt: true,
      Athlete: { select: { firstName: true } },
    },
  });

  const rows: AppNotificationFeedRow[] = [];

  for (const workout of workouts) {
    const isTomorrow =
      workout.date != null &&
      workout.date >= tomorrowStart &&
      workout.date < dayAfterTomorrow;

    if (!isTomorrow && params.unreadOnly) continue;

    const facts = {
      firstName: workout.Athlete?.firstName ?? 'there',
      workoutTitle: workout.title,
      distanceMi: formatDistanceMi(workout.estimatedDistanceInMeters),
    };

    const rendered = await renderNotificationTemplate('workout.tomorrow', facts);

    rows.push({
      id: workout.id,
      type: templateKeyToMobileType('workout.tomorrow'),
      title: rendered.title,
      body: rendered.body,
      deeplink: `/workouts/${workout.id}`,
      readAt: workout.appnotificationReminderDeliveredAt?.toISOString() ?? null,
      createdAt:
        workout.appnotificationReminderSentAt?.toISOString() ?? new Date().toISOString(),
      payload: { workoutId: workout.id, screen: 'workout', reminderKind: 'tomorrow' },
    });
  }

  return rows.slice(0, take);
}

export async function markAppNotificationRead(params: {
  athleteId: string;
  deliveryId: string;
}): Promise<boolean> {
  const row = await prisma.workouts.findFirst({
    where: {
      id: params.deliveryId,
      athleteId: params.athleteId,
      appnotificationReminderSentAt: { not: null },
    },
  });
  if (!row) return false;

  await prisma.workouts.update({
    where: { id: params.deliveryId },
    data: { appnotificationReminderDeliveredAt: new Date() },
  });
  return true;
}

export async function countUnreadAppNotifications(athleteId: string): Promise<number> {
  return prisma.workouts.count({
    where: {
      athleteId,
      appnotificationReminderSentAt: { not: null },
      appnotificationReminderDeliveredAt: null,
    },
  });
}

export async function countReadAppNotificationsSince(
  athleteId: string,
  since: Date
): Promise<number> {
  return prisma.workouts.count({
    where: {
      athleteId,
      appnotificationReminderDeliveredAt: { gte: since },
    },
  });
}
