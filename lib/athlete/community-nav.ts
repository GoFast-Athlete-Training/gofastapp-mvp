import { athleteCommunityAppPath } from '@/lib/gofast-with-me/athlete-community-routes';
import {
  STUDIO_CONTENT_NAV_ORDER,
  type ContentEditorFocus,
  type StudioSection,
} from '@/components/gofast-with-me/studio-sections';

export const COMMUNITY_HUB_PATH = '/community/hub';

export const MANAGE_COMMUNITY_LABEL = 'Manage Community';

/** Deep-link into the content studio (no entry “doors”). */
export function studioContentPath(section: StudioSection, focus?: ContentEditorFocus): string {
  const params = new URLSearchParams({ studio: 'content', view: section });
  if (focus) params.set('focus', focus);
  return `/gofast-with-others?${params.toString()}`;
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
  return pathname === '/gofast-with-others' || pathname.startsWith('/gofast-with-others/');
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
