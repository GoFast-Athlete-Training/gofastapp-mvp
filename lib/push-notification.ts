import { prisma } from '@/lib/prisma';
import { sendExpoPushBatch } from '@/lib/expo-push';
import type { Prisma } from '@prisma/client';

export type PushNotificationType =
  | 'workout_complete'
  | 'crew_announcement'
  | 'run_reminder'
  | 'club_run_tomorrow'
  | 'club_run_today';

export type SendPushToAthleteParams = {
  athleteId: string;
  type: PushNotificationType;
  title: string;
  body: string;
  /** Unique key — upserts athlete_notifications to avoid duplicate sends. */
  dedupeKey: string;
  deeplink?: string;
  payload?: Record<string, unknown>;
  /** When false, skip Expo push (in-app row only). Default true. */
  sendPush?: boolean;
};

export async function sendPushToAthlete(
  params: SendPushToAthleteParams
): Promise<{ notificationId: string; pushesSent: number }> {
  const now = new Date();
  const sendPush = params.sendPush !== false;

  const notification = await prisma.athlete_notifications.upsert({
    where: { dedupeKey: params.dedupeKey },
    create: {
      athleteId: params.athleteId,
      type: params.type,
      title: params.title,
      body: params.body,
      deeplink: params.deeplink ?? null,
      scheduledFor: now,
      dedupeKey: params.dedupeKey,
      payload: (params.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    update: {
      title: params.title,
      body: params.body,
      deeplink: params.deeplink ?? null,
      scheduledFor: now,
      payload: (params.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    select: { id: true, sentAt: true },
  });

  if (!sendPush || notification.sentAt) {
    return { notificationId: notification.id, pushesSent: 0 };
  }

  const tokens = await prisma.athlete_push_tokens.findMany({
    where: { athleteId: params.athleteId, enabled: true },
    select: { expoPushToken: true },
  });

  if (tokens.length === 0) {
    return { notificationId: notification.id, pushesSent: 0 };
  }

  const data: Record<string, unknown> = {
    ...(params.payload ?? {}),
    notificationId: notification.id,
    type: params.type,
  };
  if (params.deeplink) data.deeplink = params.deeplink;

  const pushesSent = await sendExpoPushBatch(
    tokens.map((t) => t.expoPushToken),
    {
      title: params.title,
      body: params.body,
      data,
    }
  );

  if (pushesSent > 0) {
    await prisma.athlete_notifications.update({
      where: { id: notification.id },
      data: { sentAt: now },
    });
  }

  return { notificationId: notification.id, pushesSent };
}
