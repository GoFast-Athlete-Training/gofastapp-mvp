import { renderNotificationTemplate } from '@/lib/app-notifications/templates';
import {
  templateKeyToMobileType,
  type AppNotificationFeedRow,
} from '@/lib/app-notifications/types';
import { prisma } from '@/lib/prisma';

export const REMINDER_FEED_ID_PREFIX = 'reminder:';
export const COMPLETE_FEED_ID_PREFIX = 'complete:';

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function formatDistanceMi(meters: number | null | undefined): string | null {
  if (meters == null || meters <= 0) return null;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

export function parseAppNotificationFeedId(
  deliveryId: string
): { kind: 'reminder' | 'complete'; workoutId: string } | null {
  if (deliveryId.startsWith(REMINDER_FEED_ID_PREFIX)) {
    const workoutId = deliveryId.slice(REMINDER_FEED_ID_PREFIX.length).trim();
    return workoutId ? { kind: 'reminder', workoutId } : null;
  }
  if (deliveryId.startsWith(COMPLETE_FEED_ID_PREFIX)) {
    const workoutId = deliveryId.slice(COMPLETE_FEED_ID_PREFIX.length).trim();
    return workoutId ? { kind: 'complete', workoutId } : null;
  }
  // Legacy inbox ids were bare workout ids (tomorrow reminders only).
  const legacy = deliveryId.trim();
  return legacy ? { kind: 'reminder', workoutId: legacy } : null;
}

/**
 * Derived in-app feed from workout reminder + complete stamps (no delivery table).
 */
export async function getAppNotificationFeed(params: {
  athleteId: string;
  unreadOnly?: boolean;
  take?: number;
}): Promise<AppNotificationFeedRow[]> {
  const take = params.take ?? 30;
  const now = new Date();
  const todayStart = startOfUtcDay(now);

  const [reminderWorkouts, completeWorkouts] = await Promise.all([
    prisma.workouts.findMany({
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
        workoutType: true,
        date: true,
        estimatedDistanceInMeters: true,
        appnotificationReminderSentAt: true,
        appnotificationReminderDeliveredAt: true,
        Athlete: { select: { firstName: true } },
      },
    }),
    prisma.workouts.findMany({
      where: {
        athleteId: params.athleteId,
        appnotificationCompleteSentAt: { not: null },
        ...(params.unreadOnly ? { appnotificationCompleteDeliveredAt: null } : {}),
      },
      orderBy: { appnotificationCompleteSentAt: 'desc' },
      take,
      select: {
        id: true,
        title: true,
        appnotificationCompleteSentAt: true,
        appnotificationCompleteDeliveredAt: true,
        Athlete: { select: { firstName: true } },
      },
    }),
  ]);

  const rows: AppNotificationFeedRow[] = [];

  for (const workout of reminderWorkouts) {
    if (params.unreadOnly) {
      if (workout.appnotificationReminderDeliveredAt != null) continue;
      if (workout.date == null || workout.date < todayStart) continue;
    }

    const facts = {
      firstName: workout.Athlete?.firstName ?? 'there',
      workoutTitle: workout.title,
      workoutType: workout.workoutType,
      distanceMi: formatDistanceMi(workout.estimatedDistanceInMeters),
    };

    const rendered = await renderNotificationTemplate('workout.tomorrow', facts);

    rows.push({
      id: `${REMINDER_FEED_ID_PREFIX}${workout.id}`,
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

  for (const workout of completeWorkouts) {
    const facts = {
      firstName: workout.Athlete?.firstName ?? 'there',
      workoutTitle: workout.title,
    };
    const rendered = await renderNotificationTemplate('workout.complete', facts);

    rows.push({
      id: `${COMPLETE_FEED_ID_PREFIX}${workout.id}`,
      type: templateKeyToMobileType('workout.complete'),
      title: rendered.title,
      body: rendered.body,
      deeplink: `/workouts/${workout.id}`,
      readAt: workout.appnotificationCompleteDeliveredAt?.toISOString() ?? null,
      createdAt:
        workout.appnotificationCompleteSentAt?.toISOString() ?? new Date().toISOString(),
      payload: { workoutId: workout.id, screen: 'workout', kind: 'complete' },
    });
  }

  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows.slice(0, take);
}

export async function markAppNotificationRead(params: {
  athleteId: string;
  deliveryId: string;
}): Promise<boolean> {
  const parsed = parseAppNotificationFeedId(params.deliveryId);
  if (!parsed) return false;

  const row = await prisma.workouts.findFirst({
    where: {
      id: parsed.workoutId,
      athleteId: params.athleteId,
      ...(parsed.kind === 'reminder'
        ? { appnotificationReminderSentAt: { not: null } }
        : { appnotificationCompleteSentAt: { not: null } }),
    },
  });
  if (!row) return false;

  await prisma.workouts.update({
    where: { id: parsed.workoutId },
    data:
      parsed.kind === 'reminder'
        ? { appnotificationReminderDeliveredAt: new Date() }
        : { appnotificationCompleteDeliveredAt: new Date() },
  });
  return true;
}

export async function countUnreadAppNotifications(athleteId: string): Promise<number> {
  const todayStart = startOfUtcDay(new Date());
  const [reminderCount, completeCount] = await Promise.all([
    prisma.workouts.count({
      where: {
        athleteId,
        appnotificationReminderSentAt: { not: null },
        appnotificationReminderDeliveredAt: null,
        date: { gte: todayStart },
      },
    }),
    prisma.workouts.count({
      where: {
        athleteId,
        appnotificationCompleteSentAt: { not: null },
        appnotificationCompleteDeliveredAt: null,
      },
    }),
  ]);
  return reminderCount + completeCount;
}

export async function countReadAppNotificationsSince(
  athleteId: string,
  since: Date
): Promise<number> {
  const [reminderCount, completeCount] = await Promise.all([
    prisma.workouts.count({
      where: {
        athleteId,
        appnotificationReminderDeliveredAt: { gte: since },
      },
    }),
    prisma.workouts.count({
      where: {
        athleteId,
        appnotificationCompleteDeliveredAt: { gte: since },
      },
    }),
  ]);
  return reminderCount + completeCount;
}
