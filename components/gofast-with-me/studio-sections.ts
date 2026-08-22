import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

/** Studio workspace — landing page, messages, runs/training, earnings, and durable tips. */
export type StudioSection = 'page' | 'community' | 'payouts' | 'workouts' | 'content';

export type StudioView = 'dashboard' | StudioSection;

export const STUDIO_CENTRAL_LABEL = 'Community Management';

export const STUDIO_BIN_ORDER: StudioSection[] = ['page', 'community', 'payouts', 'workouts', 'content'];

export const STUDIO_NAV_ORDER: StudioView[] = ['dashboard', ...STUDIO_BIN_ORDER];

export const STUDIO_NAV_LABELS: Record<StudioView, string> = {
  dashboard: STUDIO_CENTRAL_LABEL,
  page: 'Landing page',
  community: 'Daily log',
  payouts: 'Earnings & Payouts',
  workouts: 'Runs & Training',
  content: 'Tips & Thinking',
};

export const STUDIO_BIN_LABELS: Record<StudioSection, string> = {
  page: 'Landing page',
  community: 'Daily log',
  payouts: 'Earnings & Payouts',
  workouts: 'Runs & Training',
  content: 'Tips & Thinking',
};

export const STUDIO_BIN_DESCRIPTIONS: Record<StudioSection, string> = {
  page: 'Welcome, about, photo, achievements — what strangers see on your public page',
  community: 'Daily log and Chatter — how you feel today and follower conversation',
  payouts: 'Stripe Connect setup and sponsorship earnings credited to your Stripe balance',
  workouts: 'Runs and training — public plan, GoRun With Me, and workout sharing',
  content: 'Durable tips and myRunRoutes — nutrition, training thoughts, and shared routes',
};

export function isWelcomeContentComplete(values: GoFastWithMeLandingValues): boolean {
  return Boolean(
    values.welcome?.trim() &&
      values.gofastWithMeBio?.trim() &&
      values.whatYoullSeeHere?.trim() &&
      values.gofastWithMePhotoUrl?.trim()
  );
}
