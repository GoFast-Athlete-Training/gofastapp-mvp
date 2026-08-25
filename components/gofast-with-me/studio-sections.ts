import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

/** Editor workspaces opened from Build content. */
export type StudioSection = 'page' | 'community' | 'payouts' | 'workouts' | 'content';

/** Top chrome + editor routes inside studio. */
export type StudioView = 'page' | 'communityHome' | 'payouts' | StudioSection;

/** Scroll target inside Tips & routes workspace. */
export type ContentEditorFocus = 'tip' | 'route';

/** Top switcher — two surfaces + earnings. */
export type StudioChromeView = 'page' | 'communityHome' | 'payouts';

export const STUDIO_CHROME_VIEWS: StudioChromeView[] = ['page', 'communityHome', 'payouts'];

export const STUDIO_CHROME_LABELS: Record<StudioChromeView, string> = {
  page: 'Landing',
  communityHome: 'Community',
  payouts: 'Earnings',
};

export const STUDIO_LANDING_LABEL = 'Landing';
export const STUDIO_COMMUNITY_LABEL = 'Community';
export const STUDIO_EARNINGS_LABEL = 'Earnings';

/** @deprecated Use STUDIO_COMMUNITY_LABEL — kept for legacy tutorial copy. */
export const STUDIO_CENTRAL_LABEL = STUDIO_COMMUNITY_LABEL;

export const STUDIO_NAV_LABELS: Record<StudioSection, string> = {
  page: STUDIO_LANDING_LABEL,
  community: 'Daily log',
  payouts: STUDIO_EARNINGS_LABEL,
  workouts: 'Runs & Training',
  content: 'Tips',
};

export const STUDIO_BIN_LABELS: Record<StudioSection, string> = {
  ...STUDIO_NAV_LABELS,
};

export const STUDIO_BIN_DESCRIPTIONS: Record<StudioSection, string> = {
  page: 'Welcome, about, photo, achievements — what strangers see on your public page',
  community: 'Daily log and Chatter — how you feel today and follower conversation',
  payouts: 'Stripe Connect setup and sponsorship earnings credited to your Stripe balance',
  workouts: 'Runs and training — public plan, GoRun With Me, and workout sharing',
  content: 'Durable tips — nutrition, training thoughts, and what you want followers to revisit',
};

export const STUDIO_ROUTES_NAV_LABEL = 'Routes';

export const STUDIO_ROUTES_DESCRIPTION =
  'Share routes you love — Strava links or favorites from the city catalog';

/** Legacy flat order for tutorials. */
export const STUDIO_BIN_ORDER: StudioSection[] = [
  'page',
  'payouts',
  'community',
  'workouts',
  'content',
];

export function isStudioChromeView(view: StudioView): view is StudioChromeView {
  return view === 'page' || view === 'communityHome' || view === 'payouts';
}

export function chromeViewForEditor(section: StudioSection): StudioChromeView {
  if (section === 'page') return 'page';
  if (section === 'payouts') return 'payouts';
  return 'communityHome';
}

export function isWelcomeContentComplete(values: GoFastWithMeLandingValues): boolean {
  return Boolean(
    values.welcome?.trim() &&
      values.gofastWithMeBio?.trim() &&
      values.whatYoullSeeHere?.trim() &&
      values.gofastWithMePhotoUrl?.trim()
  );
}
