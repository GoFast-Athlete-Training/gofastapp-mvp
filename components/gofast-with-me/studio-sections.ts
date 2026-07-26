import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

/** Studio workspace sections — goal + plan surfacing, not Feed/Runs/Community clone. */
export type StudioSection = 'page' | 'plan' | 'messages' | 'followers';

export type StudioView = 'dashboard' | StudioSection;

export const STUDIO_NAV_ORDER: StudioView[] = [
  'dashboard',
  'page',
  'plan',
  'messages',
  'followers',
];

export const STUDIO_CENTRAL_LABEL = 'Studio Central';

export const STUDIO_NAV_LABELS: Record<StudioView, string> = {
  dashboard: STUDIO_CENTRAL_LABEL,
  page: 'My Page',
  plan: 'Share my plan',
  messages: 'Messages',
  followers: 'Followers',
};

export const STUDIO_BIN_ORDER: StudioSection[] = ['page', 'plan', 'messages', 'followers'];

export const STUDIO_BIN_LABELS: Record<StudioSection, string> = {
  page: 'My Page',
  plan: 'Share my plan',
  messages: 'Messages',
  followers: 'Followers',
};

export const STUDIO_BIN_DESCRIPTIONS: Record<StudioSection, string> = {
  page: 'Your public door — landing page, photo, and What I\'m training for context',
  plan: 'Publish and share your GoFast plan — followers see your training week in the hub',
  messages: 'Announcements on the journey — race updates, milestones, what\'s next',
  followers: 'Who is following your GoFast With Me hub',
};

export function isWelcomeContentComplete(values: GoFastWithMeLandingValues): boolean {
  return Boolean(
    values.welcome?.trim() &&
      values.gofastWithMeBio?.trim() &&
      values.whatYoullSeeHere?.trim() &&
      values.gofastWithMePhotoUrl?.trim()
  );
}
