import type { Prisma } from '@prisma/client';

import { getEnabledDeviceTokens } from '@/lib/app-notifications/devices';
import { loadNotificationFacts } from '@/lib/app-notifications/facts';
import { renderNotificationTemplate } from '@/lib/app-notifications/templates';
import {
  buildDedupeKey,
  templateKeyToMobileType,
  type AppNotificationObjectType,
  type NotificationTemplateKey,
} from '@/lib/app-notifications/types';
import { sendExpoPushBatch } from '@/lib/expo-push';
import { prisma } from '@/lib/prisma';

export type SendAppNotificationParams = {
  athleteId: string;
  templateKey: NotificationTemplateKey;
  objectType: AppNotificationObjectType;
  objectId: string;
  deeplink?: string;
  payload?: Record<string, unknown>;
  /** Pre-loaded facts; when omitted, loaded from source object. */
  facts?: Record<string, unknown>;
  /** When false, record delivery only (no Expo push). Default true. */
  sendPush?: boolean;
};

export async function sendAppNotification(
  params: SendAppNotificationParams
): Promise<{ deliveryId: string; pushesSent: number }> {
  const now = new Date();
  const sendPush = params.sendPush !== false;
  const dedupeKey = buildDedupeKey(
    params.templateKey,
    params.objectType,
    params.objectId,
    params.athleteId
  );

  const delivery = await prisma.appnotification_deliveries.upsert({
    where: { dedupeKey },
    create: {
      athleteId: params.athleteId,
      templateKey: params.templateKey,
      objectType: params.objectType,
      objectId: params.objectId,
      dedupeKey,
      deeplink: params.deeplink ?? null,
      payload: (params.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    update: {
      deeplink: params.deeplink ?? null,
      payload: (params.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    select: { id: true, sentAt: true },
  });

  if (!sendPush || delivery.sentAt) {
    return { deliveryId: delivery.id, pushesSent: 0 };
  }

  const facts =
    params.facts ??
    (await loadNotificationFacts({
      athleteId: params.athleteId,
      templateKey: params.templateKey,
      objectType: params.objectType,
      objectId: params.objectId,
      payload: params.payload,
    }));

  if (!facts) {
    return { deliveryId: delivery.id, pushesSent: 0 };
  }

  const rendered = await renderNotificationTemplate(params.templateKey, facts);
  const tokens = await getEnabledDeviceTokens(params.athleteId);
  if (tokens.length === 0) {
    return { deliveryId: delivery.id, pushesSent: 0 };
  }

  const mobileType = templateKeyToMobileType(params.templateKey);
  const data: Record<string, unknown> = {
    ...(params.payload ?? {}),
    deliveryId: delivery.id,
    type: mobileType,
    templateKey: params.templateKey,
  };
  if (params.deeplink) data.deeplink = params.deeplink;

  const pushesSent = await sendExpoPushBatch(tokens, {
    title: rendered.title,
    body: rendered.body,
    data,
  });

  if (pushesSent > 0) {
    await prisma.appnotification_deliveries.update({
      where: { id: delivery.id },
      data: { sentAt: now },
    });
  }

  return { deliveryId: delivery.id, pushesSent };
}
