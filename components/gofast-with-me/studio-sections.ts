import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

export type StudioSection = 'page' | 'workouts' | 'community' | 'content';

export type StudioView = 'dashboard' | StudioSection;

export const STUDIO_NAV_ORDER: StudioView[] = [
  'dashboard',
  'page',
  'workouts',
  'community',
  'content',
];

export const STUDIO_CENTRAL_LABEL = 'GoFast With Me Central';

export const STUDIO_NAV_LABELS: Record<StudioView, string> = {
  dashboard: STUDIO_CENTRAL_LABEL,
  page: 'My Page',
  workouts: 'My Workouts',
  community: 'My Community',
  content: 'Build Content',
};

export const STUDIO_BIN_ORDER: StudioSection[] = [
  'page',
  'workouts',
  'community',
  'content',
];

export const STUDIO_BIN_LABELS: Record<StudioSection, string> = {
  page: 'My Page',
  workouts: 'My Workouts',
  community: 'My Community',
  content: 'Build Content',
};

export const STUDIO_BIN_DESCRIPTIONS: Record<StudioSection, string> = {
  page: 'Edit your public landing and photo',
  workouts: 'Share your active plan',
  community: 'Manage followers and member view',
  content: 'Create posts, tips, routes, and supporting content',
};

export function isWelcomeContentComplete(values: GoFastWithMeLandingValues): boolean {
  return Boolean(
    values.welcome?.trim() &&
      values.gofastWithMeBio?.trim() &&
      values.whatYoullSeeHere?.trim() &&
      values.gofastWithMePhotoUrl?.trim()
  );
}
