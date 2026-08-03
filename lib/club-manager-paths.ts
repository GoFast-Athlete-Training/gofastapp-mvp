/** Canonical Club Manager route helpers (product surface). */

export const CLUB_MANAGER_BASE = '/club-manager';

/** Post sign-in welcome for the clubmanage host / mode=club-manager return path. */
export function clubManagerWelcomePath(): string {
  return '/welcome-clubmanager';
}

export function clubManagerHubPath(): string {
  return CLUB_MANAGER_BASE;
}

export function clubManagerActivatePath(token?: string | null): string {
  if (token?.trim()) {
    return `${CLUB_MANAGER_BASE}/activate?token=${encodeURIComponent(token.trim())}`;
  }
  return `${CLUB_MANAGER_BASE}/activate`;
}

export type ClubManagerClubSection = 'content' | 'runs' | 'events' | 'announcements';

export function clubManagerClubPath(slug: string, section?: ClubManagerClubSection): string {
  const base = `${CLUB_MANAGER_BASE}/runclub/${slug}`;
  if (section === 'content') return `${base}/content`;
  if (section === 'runs') return `${base}/runs`;
  if (section === 'events') return `${base}/events`;
  if (section === 'announcements') return `${base}/announcements`;
  return base;
}

/** Map legacy /leader paths to club-manager equivalents. */
export function legacyLeaderPathToClubManager(pathname: string): string | null {
  if (pathname === '/leader') return clubManagerHubPath();
  const match = pathname.match(/^\/leader\/runclub\/([^/]+)(?:\/(content|runs|events|announcements))?$/);
  if (!match) return null;
  const [, slug, section] = match;
  if (!slug) return null;
  if (
    section === 'content' ||
    section === 'runs' ||
    section === 'events' ||
    section === 'announcements'
  ) {
    return clubManagerClubPath(slug, section);
  }
  return clubManagerClubPath(slug);
}
