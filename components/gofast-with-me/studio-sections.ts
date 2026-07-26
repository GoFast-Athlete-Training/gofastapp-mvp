import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

export type StudioSection = 'page' | 'workouts' | 'community' | 'content';

export type StudioView = 'dashboard' | StudioSection;

export const STUDIO_NAV_ORDER: StudioView[] = [
  'dashboard',
  'page',
  'community',
  'workouts',
  'content',
];

export const STUDIO_CENTRAL_LABEL = 'GoFast With Me Central';

export const STUDIO_NAV_LABELS: Record<StudioView, string> = {
  dashboard: STUDIO_CENTRAL_LABEL,
  page: 'My Page',
  workouts: 'My Workouts',
  community: 'My Community',
  content: 'My Content',
};

export const STUDIO_BIN_ORDER: StudioSection[] = [
  'page',
  'community',
  'workouts',
  'content',
];

export const STUDIO_BIN_LABELS: Record<StudioSection, string> = {
  page: 'My Page',
  workouts: 'My Workouts',
  community: 'My Community',
  content: 'My Content',
};

export const STUDIO_BIN_DESCRIPTIONS: Record<StudioSection, string> = {
  page: 'Your public door — landing page and photo',
  community: 'Your member room — followers and engagement',
  workouts: 'Share your active plan into the room',
  content: 'Posts, tips, routes, and supporting content',
};

export function isWelcomeContentComplete(values: GoFastWithMeLandingValues): boolean {
  return Boolean(
    values.welcome?.trim() &&
      values.gofastWithMeBio?.trim() &&
      values.whatYoullSeeHere?.trim() &&
      values.gofastWithMePhotoUrl?.trim()
  );
}
