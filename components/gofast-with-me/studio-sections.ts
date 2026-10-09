import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

/** Manage workspaces — engagement, not content creation. */
export type StudioManageSection = 'announcements' | 'chatter' | 'members';

/** Build workspaces — content that surfaces on Landing and Community. */
export type StudioBuildSection = 'reflections' | 'workouts' | 'content';

/** Landing editors — public page identity. */
export type StudioLandingSection = 'page' | 'runnerStory';

/** Left-nav editor workspaces. */
export type StudioSection = StudioLandingSection | StudioBuildSection | StudioManageSection;

/** Preview surfaces — last in left nav under View. */
export type StudioChromeView = 'landingView' | 'communityHome';

/** Earnings panel — TopNav only, not a viewer. */
export type StudioPayoutsView = 'payouts';

/** All routable studio views. */
export type StudioView = StudioChromeView | StudioPayoutsView | StudioSection;

/** Scroll target inside Think Pieces workspace or Runs/Training split. */
export type ContentEditorFocus = 'tip' | 'route' | 'runs' | 'training';

export const STUDIO_MY_STORY_LABEL = 'My Story';
export const STUDIO_RUNNER_STORY_LABEL = 'Runner story';

export const STUDIO_CHROME_VIEWS: StudioChromeView[] = ['landingView', 'communityHome'];

export const STUDIO_VIEW_SECTION_HINT = 'Preview only — not where you build or manage.';

export const STUDIO_VIEW_NAV_ORDER: Array<{ view: StudioChromeView; label: string; hint: string }> = [
  { view: 'landingView', label: 'Landing', hint: 'Public page preview' },
  { view: 'communityHome', label: 'Community', hint: 'Follower feed preview' },
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
  runnerStory: STUDIO_RUNNER_STORY_LABEL,
  reflections: 'Training Reflections',
  workouts: 'Runs',
  content: 'Think Pieces',
  announcements: 'Announcements',
  chatter: 'Chatter',
  members: 'Members',
};

export const STUDIO_LANDING_NAV_ORDER: Array<{ section: StudioLandingSection; label: string }> = [
  { section: 'page', label: STUDIO_MY_STORY_LABEL },
  { section: 'runnerStory', label: STUDIO_RUNNER_STORY_LABEL },
];

export const STUDIO_RUNS_TRAINING_NAV_ORDER: Array<{
  section: StudioSection;
  label: string;
  focus?: ContentEditorFocus;
}> = [
  { section: 'workouts', label: 'Runs', focus: 'runs' },
  { section: 'workouts', label: 'Training', focus: 'training' },
  { section: 'content', label: 'Routes', focus: 'route' },
];

export const STUDIO_BUILD_NAV_ORDER: Array<{
  section: StudioBuildSection;
  label: string;
  focus?: ContentEditorFocus;
}> = [
  { section: 'reflections', label: 'Training Reflections' },
  { section: 'content', label: 'Think Pieces', focus: 'tip' },
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
  page: 'Photo, welcome, and short about — your public landing',
  runnerStory: 'Full life story linked from About me',
  reflections: 'Training reflections for your feed — optional activity link',
  workouts: 'Host join-me runs followers can RSVP to',
  content: 'Essays and riffs — think pieces on your landing and feed',
  announcements: 'Journey updates followers see in your community feed',
  chatter: 'Follower conversation — review and moderate from studio',
  members: 'Who follows your athlete community — see all roster',
};

/** External route — athlete link page editor (not a StudioView). */
export const STUDIO_LINK_PAGE_HREF = '/profile/links';
export const STUDIO_LINK_PAGE_LABEL = 'Link page';

export const STUDIO_ROUTES_NAV_LABEL = 'Routes';

export const STUDIO_ROUTES_DESCRIPTION =
  'Share routes you love — Strava links or favorites from the city catalog';

/** Legacy flat order for tutorials. */
export const STUDIO_BIN_ORDER: StudioSection[] = [
  'page',
  'runnerStory',
  'reflections',
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

export function isStudioLandingSection(section: StudioSection): section is StudioLandingSection {
  return section === 'page' || section === 'runnerStory';
}

export function chromeViewForEditor(section: StudioSection): StudioChromeView {
  if (section === 'page' || section === 'runnerStory') return 'landingView';
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
