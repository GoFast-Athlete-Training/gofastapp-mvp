/** Stable keys for hardcoded templates; future content DB will use the same keys. */
export type NotificationTemplateKey =
  | 'workout.tomorrow'
  | 'scheduledRun.tomorrow'
  | 'clubRun.today'
  | 'clubRun.tomorrow'
  | 'club.chatter'
  | 'crew.announcement'
  | 'workout.complete';

export type AppNotificationObjectType =
  | 'workout'
  | 'scheduled_run'
  | 'city_run'
  | 'run_club'
  | 'run_crew_announcement';

export type TemplateFacts = Record<string, unknown>;

export type RenderedNotification = {
  title: string;
  body: string;
};

/** Mobile inbox row shape (derived feed projection). */
export type AppNotificationFeedRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  deeplink: string | null;
  readAt: string | null;
  createdAt: string;
  payload?: Record<string, unknown> | null;
};

export function buildDedupeKey(
  templateKey: NotificationTemplateKey,
  objectType: AppNotificationObjectType,
  objectId: string,
  athleteId: string
): string {
  return `${templateKey}:${objectType}:${objectId}:${athleteId}`;
}

/** Legacy mobile `type` strings for inbox UI compatibility. */
export function templateKeyToMobileType(templateKey: NotificationTemplateKey): string {
  switch (templateKey) {
    case 'workout.tomorrow':
    case 'scheduledRun.tomorrow':
      return 'run_reminder';
    case 'clubRun.today':
      return 'club_run_today';
    case 'clubRun.tomorrow':
      return 'club_run_tomorrow';
    case 'club.chatter':
      return 'club_chatter';
    case 'crew.announcement':
      return 'crew_announcement';
    case 'workout.complete':
      return 'workout_complete';
    default:
      return templateKey;
  }
}
