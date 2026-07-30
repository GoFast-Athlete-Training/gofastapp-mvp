import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

/** Studio workspace — page, community, workouts, and content bins. */
export type StudioSection = 'page' | 'community' | 'workouts' | 'content';

export type StudioView = 'dashboard' | StudioSection;

export const STUDIO_CENTRAL_LABEL = 'Studio Central';

export const STUDIO_BIN_ORDER: StudioSection[] = ['page', 'community', 'workouts', 'content'];

export const STUDIO_NAV_ORDER: StudioView[] = ['dashboard', ...STUDIO_BIN_ORDER];

export const STUDIO_NAV_LABELS: Record<StudioView, string> = {
  dashboard: STUDIO_CENTRAL_LABEL,
  page: 'My Page',
  community: 'My Community',
  workouts: 'My Workouts',
  content: 'My Content',
};

export const STUDIO_BIN_LABELS: Record<StudioSection, string> = {
  page: 'My Page',
  community: 'My Community',
  workouts: 'My Workouts',
  content: 'My Content',
};

export const STUDIO_BIN_DESCRIPTIONS: Record<StudioSection, string> = {
  page: "Your public page — landing copy, photo, and What I'm training for",
  community: 'Your personal community — messages and followers',
  workouts: 'Your training week and plan sharing for followers',
  content: 'Tips, routes, and blog posts for your hub',
};

export function isWelcomeContentComplete(values: GoFastWithMeLandingValues): boolean {
  return Boolean(
    values.welcome?.trim() &&
      values.gofastWithMeBio?.trim() &&
      values.whatYoullSeeHere?.trim() &&
      values.gofastWithMePhotoUrl?.trim()
  );
}
