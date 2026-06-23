import type { NotificationTemplateKey, RenderedNotification, TemplateFacts } from '@/lib/app-notifications/types';

export type { TemplateFacts };

type TemplateDefinition = {
  title: string | ((facts: TemplateFacts) => string);
  body: (facts: TemplateFacts) => string;
};

/**
 * Hardcoded notification templates.
 * Future state: resolveTemplate() can load copy from a content-managed table by templateKey.
 */
const HARDCODED_TEMPLATES: Record<NotificationTemplateKey, TemplateDefinition> = {
  'workout.tomorrow': {
    title: 'Tomorrow is locked in',
    body: ({ firstName, workoutTitle, distanceMi }) => {
      const name = typeof firstName === 'string' && firstName.trim() ? firstName.trim() : 'there';
      const title = typeof workoutTitle === 'string' ? workoutTitle : 'your workout';
      const dist =
        typeof distanceMi === 'string' && distanceMi.trim() ? ` (${distanceMi.trim()})` : '';
      return `Hi ${name}, get ready for ${title}${dist} tomorrow. You'll crush it!`;
    },
  },
  'scheduledRun.tomorrow': {
    title: 'Your next run is coming',
    body: ({ runTitle, detail }) => {
      const title = typeof runTitle === 'string' ? runTitle : 'your run';
      const extra = typeof detail === 'string' && detail.trim() ? ` · ${detail.trim()}` : '';
      return `Tomorrow: ${title}${extra}`;
    },
  },
  'clubRun.today': {
    title: ({ clubName }) =>
      typeof clubName === 'string' && clubName.trim() ? clubName.trim() : 'Club run today',
    body: ({ body }) => (typeof body === 'string' ? body : 'Your club run is today.'),
  },
  'clubRun.tomorrow': {
    title: ({ clubName }) =>
      typeof clubName === 'string' && clubName.trim() ? clubName.trim() : 'Club run tomorrow',
    body: ({ body }) => (typeof body === 'string' ? body : 'Your club run is tomorrow.'),
  },
  'crew.announcement': {
    title: ({ crewName }) =>
      typeof crewName === 'string' && crewName.trim() ? crewName.trim() : 'Crew announcement',
    body: ({ announcementTitle, excerpt }) => {
      if (typeof announcementTitle === 'string' && announcementTitle.trim()) {
        return announcementTitle.trim();
      }
      return typeof excerpt === 'string' ? excerpt : 'New crew announcement';
    },
  },
  'workout.complete': {
    title: 'Great workout!',
    body: ({ workoutTitle }) => {
      const title = typeof workoutTitle === 'string' ? workoutTitle : 'Workout';
      return `${title} complete — check your pace breakdown.`;
    },
  },
};

/** Stub for future content-backed templates (Company/content repo). */
export async function resolveTemplate(
  templateKey: NotificationTemplateKey
): Promise<TemplateDefinition> {
  // Future: fetch from notification_templates table or content API by templateKey.
  return HARDCODED_TEMPLATES[templateKey];
}

export async function renderNotificationTemplate(
  templateKey: NotificationTemplateKey,
  facts: TemplateFacts
): Promise<RenderedNotification> {
  const template = await resolveTemplate(templateKey);
  const title =
    typeof template.title === 'function' ? template.title(facts) : template.title;
  return { title, body: template.body(facts) };
}
