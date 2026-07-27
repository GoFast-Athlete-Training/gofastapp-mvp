import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

/** Studio workspace — door (My Page) + room (My Community). */
export type StudioSection = 'page' | 'community';

export type StudioView = 'dashboard' | StudioSection;

export const STUDIO_NAV_ORDER: StudioView[] = ['dashboard', 'page', 'community'];

export const STUDIO_CENTRAL_LABEL = 'Studio Central';

export const STUDIO_NAV_LABELS: Record<StudioView, string> = {
  dashboard: STUDIO_CENTRAL_LABEL,
  page: 'My Page',
  community: 'My Community',
};

export const STUDIO_BIN_ORDER: StudioSection[] = ['page', 'community'];

export const STUDIO_BIN_LABELS: Record<StudioSection, string> = {
  page: 'My Page',
  community: 'My Community',
};

export const STUDIO_BIN_DESCRIPTIONS: Record<StudioSection, string> = {
  page: 'Your public door — landing page, photo, and What I\'m training for',
  community:
    'Your member room — My plan, messages, and followers in one place (like a race hub)',
};

export function isWelcomeContentComplete(values: GoFastWithMeLandingValues): boolean {
  return Boolean(
    values.welcome?.trim() &&
      values.gofastWithMeBio?.trim() &&
      values.whatYoullSeeHere?.trim() &&
      values.gofastWithMePhotoUrl?.trim()
  );
}
