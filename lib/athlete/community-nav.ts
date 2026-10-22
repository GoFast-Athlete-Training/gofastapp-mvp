import { athleteCommunityAppPath } from '@/lib/gofast-with-me/athlete-community-routes';
import {
  STUDIO_CONTENT_NAV_ORDER,
  type ContentEditorFocus,
  type StudioSection,
} from '@/components/gofast-with-me/studio-sections';

export const COMMUNITY_HUB_PATH = '/community/hub';

/** Owner content studio (landing copy, story, tips, routes). */
export const CONTENT_BUILDER_PATH = '/gofast-contentbuilder';

/** @deprecated Use CONTENT_BUILDER_PATH */
export const BUILD_CONTENT_PATH = CONTENT_BUILDER_PATH;

export const CONTENT_BUILDER_LABEL = 'Content builder';

/** @deprecated Use CONTENT_BUILDER_LABEL */
export const BUILD_CONTENT_LABEL = CONTENT_BUILDER_LABEL;

export const GOFAST_LINKS_PATH = '/links';

export const GOFAST_LINKS_LABEL = 'Links';

export const MANAGE_COMMUNITY_LABEL = 'Manage Community';

export function isGoFastLinksPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === GOFAST_LINKS_PATH || pathname.startsWith(`${GOFAST_LINKS_PATH}/`);
}

/** @deprecated Use `/gofast-with-others` redirect only */
export const LEGACY_GOFAST_WITH_OTHERS_PATH = '/gofast-with-others';

export function contentBuilderPayoutsPath(): string {
  return `${CONTENT_BUILDER_PATH}?view=payouts`;
}

/** Deep-link into the content studio (no entry “doors”). */
export function studioContentPath(section: StudioSection, focus?: ContentEditorFocus): string {
  const params = new URLSearchParams({ studio: 'content', view: section });
  if (focus) params.set('focus', focus);
  return `${CONTENT_BUILDER_PATH}?${params.toString()}`;
}

export function communityHubPathForHandle(handle: string): string {
  return athleteCommunityAppPath(handle);
}

export function isCommunityHubPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === COMMUNITY_HUB_PATH) return true;
  return /^\/u\/[^/]+\/community\/?$/.test(pathname);
}

export function isContentStudioPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === CONTENT_BUILDER_PATH || pathname.startsWith(`${CONTENT_BUILDER_PATH}/`)) {
    return true;
  }
  return (
    pathname === LEGACY_GOFAST_WITH_OTHERS_PATH ||
    pathname.startsWith(`${LEGACY_GOFAST_WITH_OTHERS_PATH}/`)
  );
}

export function isContentNavItemActive(
  pathname: string | null,
  viewParam: string | null,
  focusParam: string | null,
  section: StudioSection,
  focus?: ContentEditorFocus
): boolean {
  if (!isContentStudioPath(pathname)) return false;
  if (viewParam !== section) return false;
  if (section === 'content') {
    return (focusParam ?? 'tip') === (focus ?? 'tip');
  }
  return true;
}

/** Sidebar links for landing / athletelinks content (runs live under Run & Activity). */
export const ATHLETE_CONTENT_SIDEBAR_NAV = STUDIO_CONTENT_NAV_ORDER.map((item) => ({
  label: item.label,
  href: studioContentPath(item.section, item.focus),
  section: item.section,
  focus: item.focus,
}));
