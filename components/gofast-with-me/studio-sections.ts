import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

export type StudioSection = 'page' | 'workouts' | 'community' | 'content';

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
  content: 'Content',
};

export const STUDIO_BIN_DESCRIPTIONS: Record<StudioSection, string> = {
  page: 'Landing identity, run photo, and public URL',
  workouts: 'Active training plan and hosted runs',
  community: 'Followers, announcements, member container',
  content: 'Tips, routes, blog, and CMS content',
};

export function isWelcomeContentComplete(values: GoFastWithMeLandingValues): boolean {
  return Boolean(
    values.welcome?.trim() &&
      values.gofastWithMeBio?.trim() &&
      values.whatYoullSeeHere?.trim() &&
      values.gofastWithMePhotoUrl?.trim()
  );
}
