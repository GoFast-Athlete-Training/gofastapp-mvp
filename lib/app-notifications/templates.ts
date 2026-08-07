import type { NotificationTemplateKey, RenderedNotification, TemplateFacts } from '@/lib/app-notifications/types';
import type { ActivitySport } from '@/lib/training/activity-type-sets';

export type { TemplateFacts };

function activitySportFromFacts(facts: TemplateFacts): ActivitySport {
  const sport = facts.activitySport;
  if (sport === 'run' || sport === 'cycle' || sport === 'swim' || sport === 'other') {
    return sport;
  }
  return 'other';
}

function syncedActivityTitle(sport: ActivitySport): string {
  switch (sport) {
    case 'run':
      return 'Run logged!';
    case 'cycle':
      return 'Ride logged!';
    case 'swim':
      return 'Swim logged!';
    default:
      return 'Another activity in the books!';
  }
}

function syncedActivityNoun(sport: ActivitySport): string {
  switch (sport) {
    case 'run':
      return 'Your run';
    case 'cycle':
      return 'Your ride';
    case 'swim':
      return 'Your swim';
    default:
      return 'Your activity';
  }
}

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
    title: ({ workoutTitle, distanceMi }) => {
      const title = typeof workoutTitle === 'string' && workoutTitle.trim() ? workoutTitle.trim() : 'Workout';
      const dist =
        typeof distanceMi === 'string' && distanceMi.trim() ? ` · ${distanceMi.trim()}` : '';
      return `Tomorrow: ${title}${dist}`;
    },
    body: ({ workoutTitle, distanceMi, workoutType }) => {
      const title = typeof workoutTitle === 'string' && workoutTitle.trim() ? workoutTitle.trim() : 'your workout';
      const dist =
        typeof distanceMi === 'string' && distanceMi.trim() ? ` (${distanceMi.trim()})` : '';
      const type =
        typeof workoutType === 'string' && workoutType.trim() ? ` ${workoutType.trim()}` : '';
      return `Please verify${type} ${title}${dist} is correct in GoFast, then send it to your Garmin watch.`;
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
  'club.chatter': {
    title: ({ clubName }) =>
      typeof clubName === 'string' && clubName.trim() ? clubName.trim() : 'Run club',
    body: ({ excerpt }) =>
      typeof excerpt === 'string' && excerpt.trim() ? excerpt.trim() : 'said something in the club chat',
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
  'activity.synced': {
    title: (facts) => syncedActivityTitle(activitySportFromFacts(facts)),
    body: (facts) => {
      const sport = activitySportFromFacts(facts);
      const title =
        typeof facts.activityTitle === 'string' && facts.activityTitle.trim()
          ? facts.activityTitle.trim()
          : syncedActivityNoun(sport);
      const dist =
        typeof facts.distanceMi === 'string' && facts.distanceMi.trim()
          ? ` (${facts.distanceMi.trim()})`
          : '';
      return `${title}${dist} synced from Garmin — nice work!`;
    },
  },
  'sponsorship.received': {
    title: ({ brandName }) =>
      typeof brandName === 'string' && brandName.trim()
        ? `${brandName.trim()} is sponsoring you`
        : 'You have a new sponsor',
    body: ({ brandName }) => {
      const brand =
        typeof brandName === 'string' && brandName.trim() ? brandName.trim() : 'A brand';
      return `${brand} just activated a Brand Partnership on your GoFast profile.`;
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
