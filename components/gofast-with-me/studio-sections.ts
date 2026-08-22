import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

/** Studio workspace — landing page, daily log, runs/training, earnings, tips, and routes. */
export type StudioSection = 'page' | 'community' | 'payouts' | 'workouts' | 'content';

export type StudioView = 'dashboard' | StudioSection;

/** Scroll target inside Tips & routes workspace. */
export type ContentEditorFocus = 'tip' | 'route';

export const STUDIO_CENTRAL_LABEL = 'Community Management';

/** Sidebar grouping — build content, manage, earnings. */
export const STUDIO_BUILD_CONTENT_SECTIONS: StudioSection[] = ['community', 'content', 'workouts'];

export const STUDIO_MANAGE_SECTIONS: StudioSection[] = ['page'];

export const STUDIO_EARNINGS_SECTIONS: StudioSection[] = ['payouts'];

/** Flat order for tutorials and legacy references. */
export const STUDIO_BIN_ORDER: StudioSection[] = [
  ...STUDIO_MANAGE_SECTIONS,
  ...STUDIO_EARNINGS_SECTIONS,
  ...STUDIO_BUILD_CONTENT_SECTIONS,
];

export const STUDIO_NAV_ORDER: StudioView[] = ['dashboard', ...STUDIO_BIN_ORDER];

export const STUDIO_NAV_LABELS: Record<StudioView, string> = {
  dashboard: STUDIO_CENTRAL_LABEL,
  page: 'Landing page',
  community: 'Daily log',
  payouts: 'Earnings & Payouts',
  workouts: 'Runs & Training',
  content: 'Tips',
};

export const STUDIO_BIN_LABELS: Record<StudioSection, string> = {
  page: 'Landing page',
  community: 'Daily log',
  payouts: 'Earnings & Payouts',
  workouts: 'Runs & Training',
  content: 'Tips',
};

export const STUDIO_ROUTES_NAV_LABEL = 'Routes';

export const STUDIO_BIN_DESCRIPTIONS: Record<StudioSection, string> = {
  page: 'Welcome, about, photo, achievements — what strangers see on your public page',
  community: 'Daily log and Chatter — how you feel today and follower conversation',
  payouts: 'Stripe Connect setup and sponsorship earnings credited to your Stripe balance',
  workouts: 'Runs and training — public plan, GoRun With Me, and workout sharing',
  content: 'Durable tips — nutrition, training thoughts, and what you want followers to revisit',
};

export const STUDIO_ROUTES_DESCRIPTION =
  'Share routes you love — Strava links or favorites from the city catalog';

export function isWelcomeContentComplete(values: GoFastWithMeLandingValues): boolean {
  return Boolean(
    values.welcome?.trim() &&
      values.gofastWithMeBio?.trim() &&
      values.whatYoullSeeHere?.trim() &&
      values.gofastWithMePhotoUrl?.trim()
  );
}
