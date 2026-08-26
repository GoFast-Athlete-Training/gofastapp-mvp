import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

/** Manage workspaces — engagement, not content creation. */
export type StudioManageSection = 'announcements' | 'chatter' | 'members';

/** Build workspaces — content that surfaces on Landing and Community. */
export type StudioBuildSection = 'community' | 'workouts' | 'content';

/** Left-nav editor workspaces (My Story + build + manage). */
export type StudioSection = 'page' | StudioBuildSection | StudioManageSection;

/** Preview surfaces — last in left nav under View. */
export type StudioChromeView = 'landingView' | 'communityHome';

/** Earnings panel — TopNav only, not a viewer. */
export type StudioPayoutsView = 'payouts';

/** All routable studio views. */
export type StudioView = StudioChromeView | StudioPayoutsView | StudioSection;

/** Scroll target inside Tips & routes workspace. */
export type ContentEditorFocus = 'tip' | 'route';

export const STUDIO_MY_STORY_LABEL = 'My Story';

export const STUDIO_CHROME_VIEWS: StudioChromeView[] = ['landingView', 'communityHome'];

export const STUDIO_VIEW_NAV_ORDER: Array<{ view: StudioChromeView; label: string }> = [
  { view: 'landingView', label: 'Landing' },
  { view: 'communityHome', label: 'Community' },
];

export const STUDIO_CHROME_LABELS: Record<StudioChromeView, string> = {
  landingView: 'Landing',
  communityHome: 'Community',
};

export const STUDIO_LANDING_LABEL = 'Landing';
export const STUDIO_COMMUNITY_LABEL = 'Community';
export const STUDIO_EARNINGS_LABEL = 'Earnings';

/** @deprecated Use STUDIO_COMMUNITY_LABEL — kept for legacy tutorial copy. */
export const STUDIO_CENTRAL_LABEL = STUDIO_COMMUNITY_LABEL;

export const STUDIO_NAV_LABELS: Record<StudioSection, string> = {
  page: STUDIO_MY_STORY_LABEL,
  community: 'Daily log',
  workouts: 'Runs & Training',
  content: 'Tips',
  announcements: 'Announcements',
  chatter: 'Chatter',
  members: 'Members',
};

export const STUDIO_BUILD_NAV_ORDER: Array<{
  section: StudioBuildSection;
  label: string;
  focus?: ContentEditorFocus;
}> = [
  { section: 'community', label: 'Daily log' },
  { section: 'content', label: 'Tips', focus: 'tip' },
  { section: 'content', label: 'Routes', focus: 'route' },
  { section: 'workouts', label: 'Runs & Training' },
];

export const STUDIO_MANAGE_NAV_ORDER: Array<{ section: StudioManageSection; label: string }> = [
  { section: 'announcements', label: 'Announcements' },
  { section: 'chatter', label: 'Chatter' },
  { section: 'members', label: 'Members' },
];

export const STUDIO_BIN_LABELS: Record<StudioSection, string> = {
  ...STUDIO_NAV_LABELS,
};

export const STUDIO_BIN_DESCRIPTIONS: Record<StudioSection, string> = {
  page: 'Photo, welcome, and about — your public who-am-I page',
  community: 'How you feel today — posts spill into the member feed',
  workouts: 'Host a joinable run first — plan sharing is optional',
  content: 'Durable tips — nutrition, training thoughts, and what followers revisit',
  announcements: 'Journey updates followers see in your community feed',
  chatter: 'Follower conversation — review and moderate from studio',
  members: 'Who follows your athlete community',
};

export const STUDIO_ROUTES_NAV_LABEL = 'Routes';

export const STUDIO_ROUTES_DESCRIPTION =
  'Share routes you love — Strava links or favorites from the city catalog';

/** Legacy flat order for tutorials. */
export const STUDIO_BIN_ORDER: StudioSection[] = [
  'page',
  'community',
  'workouts',
  'content',
  'announcements',
  'chatter',
  'members',
];

export function isStudioChromeView(view: StudioView): view is StudioChromeView {
  return view === 'landingView' || view === 'communityHome';
}

export function isStudioManageSection(section: StudioSection): section is StudioManageSection {
  return section === 'announcements' || section === 'chatter' || section === 'members';
}

export function chromeViewForEditor(section: StudioSection): StudioChromeView {
  if (section === 'page') return 'landingView';
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
