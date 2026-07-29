import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

/** Studio workspace — door, room, plan, and content bins. */
export type StudioSection = 'page' | 'community' | 'plan' | 'content';

export type StudioView = 'dashboard' | StudioSection;

export const STUDIO_CENTRAL_LABEL = 'Studio Central';

export const STUDIO_BIN_ORDER: StudioSection[] = ['page', 'community', 'plan', 'content'];

export const STUDIO_NAV_ORDER: StudioView[] = ['dashboard', ...STUDIO_BIN_ORDER];

export const STUDIO_NAV_LABELS: Record<StudioView, string> = {
  dashboard: STUDIO_CENTRAL_LABEL,
  page: 'My Page',
  community: 'My Community',
  plan: 'My Plan',
  content: 'My Content',
};

export const STUDIO_BIN_LABELS: Record<StudioSection, string> = {
  page: 'My Page',
  community: 'My Community',
  plan: 'My Plan',
  content: 'My Content',
};

export const STUDIO_BIN_DESCRIPTIONS: Record<StudioSection, string> = {
  page: "Your public door — landing page, photo, and What I'm training for",
  community: 'Your member room — messages and followers',
  plan: 'Publish and share your training plan with followers',
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
