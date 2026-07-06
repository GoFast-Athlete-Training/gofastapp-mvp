/** Canonical Club Manager route helpers (product surface). */

export const CLUB_MANAGER_BASE = '/club-manager';

export function clubManagerHubPath(): string {
  return CLUB_MANAGER_BASE;
}

export function clubManagerActivatePath(token?: string | null): string {
  if (token?.trim()) {
    return `${CLUB_MANAGER_BASE}/activate?token=${encodeURIComponent(token.trim())}`;
  }
  return `${CLUB_MANAGER_BASE}/activate`;
}

export function clubManagerClubPath(slug: string, section?: 'content' | 'runs' | 'announcements'): string {
  const base = `${CLUB_MANAGER_BASE}/runclub/${slug}`;
  if (section === 'content') return `${base}/content`;
  if (section === 'runs') return `${base}/runs`;
  if (section === 'announcements') return `${base}/announcements`;
  return base;
}

/** Map legacy /leader paths to club-manager equivalents. */
export function legacyLeaderPathToClubManager(pathname: string): string | null {
  if (pathname === '/leader') return clubManagerHubPath();
  const match = pathname.match(/^\/leader\/runclub\/([^/]+)(?:\/(content|runs|announcements))?$/);
  if (!match) return null;
  const [, slug, section] = match;
  if (!slug) return null;
  if (section === 'content' || section === 'runs' || section === 'announcements') {
    return clubManagerClubPath(slug, section);
  }
  return clubManagerClubPath(slug);
}
