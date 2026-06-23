import { loadNotificationFacts } from '@/lib/app-notifications/facts';
import { renderNotificationTemplate } from '@/lib/app-notifications/templates';
import {
  templateKeyToMobileType,
  type AppNotificationFeedRow,
  type NotificationTemplateKey,
} from '@/lib/app-notifications/types';
import { prisma } from '@/lib/prisma';

/**
 * Derived in-app notification feed — renders template copy from delivery rows + source objects.
 * Pure UI prompts (e.g. Runs tab club reminder banner) stay computed on their own screens.
 */
export async function getAppNotificationFeed(params: {
  athleteId: string;
  unreadOnly?: boolean;
  take?: number;
}): Promise<AppNotificationFeedRow[]> {
  const deliveries = await prisma.appnotification_deliveries.findMany({
    where: {
      athleteId: params.athleteId,
      ...(params.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: params.take ?? 30,
  });

  const rows: AppNotificationFeedRow[] = [];

  for (const delivery of deliveries) {
    const templateKey = delivery.templateKey as NotificationTemplateKey;
    const payload =
      delivery.payload && typeof delivery.payload === 'object' && !Array.isArray(delivery.payload)
        ? (delivery.payload as Record<string, unknown>)
        : null;

    const facts = await loadNotificationFacts({
      athleteId: delivery.athleteId,
      templateKey,
      objectType: delivery.objectType as import('@/lib/app-notifications/types').AppNotificationObjectType,
      objectId: delivery.objectId,
      payload,
    });

    if (!facts) continue;

    const rendered = await renderNotificationTemplate(templateKey, facts);

    rows.push({
      id: delivery.id,
      type: templateKeyToMobileType(templateKey),
      title: rendered.title,
      body: rendered.body,
      deeplink: delivery.deeplink,
      readAt: delivery.readAt?.toISOString() ?? null,
      createdAt: delivery.createdAt.toISOString(),
      payload,
    });
  }

  return rows;
}

export async function markAppNotificationRead(params: {
  athleteId: string;
  deliveryId: string;
}): Promise<boolean> {
  const row = await prisma.appnotification_deliveries.findFirst({
    where: { id: params.deliveryId, athleteId: params.athleteId },
  });
  if (!row) return false;

  await prisma.appnotification_deliveries.update({
    where: { id: params.deliveryId },
    data: { readAt: new Date() },
  });
  return true;
}

export async function countUnreadAppNotifications(athleteId: string): Promise<number> {
  return prisma.appnotification_deliveries.count({
    where: { athleteId, readAt: null },
  });
}

export async function countReadAppNotificationsSince(
  athleteId: string,
  since: Date
): Promise<number> {
  return prisma.appnotification_deliveries.count({
    where: { athleteId, readAt: { gte: since } },
  });
}
