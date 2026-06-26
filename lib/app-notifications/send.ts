import { getEnabledDeviceTokens } from '@/lib/app-notifications/devices';
import { loadNotificationFacts } from '@/lib/app-notifications/facts';
import { renderNotificationTemplate } from '@/lib/app-notifications/templates';
import {
  templateKeyToMobileType,
  type AppNotificationObjectType,
  type NotificationTemplateKey,
} from '@/lib/app-notifications/types';
import { sendExpoPushBatch } from '@/lib/expo-push';

export type SendAppNotificationParams = {
  athleteId: string;
  templateKey: NotificationTemplateKey;
  objectType: AppNotificationObjectType;
  objectId: string;
  deeplink?: string;
  payload?: Record<string, unknown>;
  /** Pre-loaded facts; when omitted, loaded from source object. */
  facts?: Record<string, unknown>;
  /** When false, skip Expo push. Default true. */
  sendPush?: boolean;
};

/**
 * Trigger-driven push — no persisted delivery rows.
 * Workout reminders use sendPlannedWorkoutReminders + workouts send state instead.
 */
export async function sendAppNotification(
  params: SendAppNotificationParams
): Promise<{ pushesSent: number }> {
  const sendPush = params.sendPush !== false;
  if (!sendPush) {
    return { pushesSent: 0 };
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
    return { pushesSent: 0 };
  }

  const rendered = await renderNotificationTemplate(params.templateKey, facts);
  const tokens = await getEnabledDeviceTokens(params.athleteId);
  if (tokens.length === 0) {
    return { pushesSent: 0 };
  }

  const mobileType = templateKeyToMobileType(params.templateKey);
  const data: Record<string, unknown> = {
    ...(params.payload ?? {}),
    type: mobileType,
    templateKey: params.templateKey,
    objectType: params.objectType,
    objectId: params.objectId,
  };
  if (params.deeplink) data.deeplink = params.deeplink;

  const pushesSent = await sendExpoPushBatch(tokens, {
    title: rendered.title,
    body: rendered.body,
    data,
  });

  return { pushesSent };
}
