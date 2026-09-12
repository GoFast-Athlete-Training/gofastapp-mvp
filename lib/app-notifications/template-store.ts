import { interpolateTemplateString } from '@/lib/app-notifications/interpolate';
import type { NotificationTemplateKey, TemplateFacts } from '@/lib/app-notifications/types';
import { prisma } from '@/lib/prisma';

export type AppNotificationTemplateRow = {
  id: string;
  templateKey: string;
  name: string;
  title: string;
  body: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function listAppNotificationTemplates(): Promise<AppNotificationTemplateRow[]> {
  return prisma.app_notification_templates.findMany({
    orderBy: [{ templateKey: 'asc' }],
  });
}

export async function getAppNotificationTemplateByKey(
  templateKey: string,
): Promise<AppNotificationTemplateRow | null> {
  return prisma.app_notification_templates.findUnique({
    where: { templateKey },
  });
}

export async function updateAppNotificationTemplate(
  templateKey: string,
  data: { name?: string; title?: string; body?: string; isActive?: boolean },
): Promise<AppNotificationTemplateRow> {
  return prisma.app_notification_templates.update({
    where: { templateKey },
    data,
  });
}

export function renderDbTemplate(
  row: Pick<AppNotificationTemplateRow, 'title' | 'body'>,
  facts: TemplateFacts,
): { title: string; body: string } {
  return {
    title: interpolateTemplateString(row.title, facts),
    body: interpolateTemplateString(row.body, facts),
  };
}

export async function resolveDbTemplate(
  templateKey: NotificationTemplateKey,
  facts: TemplateFacts,
): Promise<{ title: string; body: string } | null> {
  const row = await prisma.app_notification_templates.findUnique({
    where: { templateKey },
  });
  if (!row?.isActive) return null;
  return renderDbTemplate(row, facts);
}
