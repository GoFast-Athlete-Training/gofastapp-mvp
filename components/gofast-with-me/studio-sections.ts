import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

/** Studio workspace — page, community, workouts, and content bins. */
export type StudioSection = 'page' | 'community' | 'workouts' | 'content';

export type StudioView = 'dashboard' | StudioSection;

export const STUDIO_CENTRAL_LABEL = 'Community Dashboard';

export const STUDIO_BIN_ORDER: StudioSection[] = ['page', 'community', 'workouts', 'content'];

export const STUDIO_NAV_ORDER: StudioView[] = ['dashboard', ...STUDIO_BIN_ORDER];

export const STUDIO_NAV_LABELS: Record<StudioView, string> = {
  dashboard: STUDIO_CENTRAL_LABEL,
  page: 'Page Settings',
  community: 'Updates & Members',
  workouts: 'Runs & Training',
  content: 'Tips & Thinking',
};

export const STUDIO_BIN_LABELS: Record<StudioSection, string> = {
  page: 'Page Settings',
  community: 'Updates & Members',
  workouts: 'Runs & Training',
  content: 'Tips & Thinking',
};

export const STUDIO_BIN_DESCRIPTIONS: Record<StudioSection, string> = {
  page: "Public front door settings — landing copy, photo, and What I'm training for",
  community: 'Community feed controls — updates, chatter review, follower view, and members',
  workouts: 'Runs and training — public plan, GoRun With Me, and workout sharing',
  content: 'Durable tips and thinking — nutrition, routes, training thoughts, and future blog',
};

export function isWelcomeContentComplete(values: GoFastWithMeLandingValues): boolean {
  return Boolean(
    values.welcome?.trim() &&
      values.gofastWithMeBio?.trim() &&
      values.whatYoullSeeHere?.trim() &&
      values.gofastWithMePhotoUrl?.trim()
  );
}
