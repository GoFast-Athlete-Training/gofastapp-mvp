import type { LeaderContextClub } from '@/lib/run-club-leader-context';

export type ClubManagerWelcomedClub = {
  runClubSlug: string | null;
  runClubName: string;
  ackedAt: string;
};

export type ClubManagerState = {
  welcomed?: Record<string, ClubManagerWelcomedClub>;
};

export function parseClubManagerState(raw: unknown): ClubManagerState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const welcomedRaw = (raw as ClubManagerState).welcomed;
  if (!welcomedRaw || typeof welcomedRaw !== 'object' || Array.isArray(welcomedRaw)) {
    return {};
  }

  const welcomed: Record<string, ClubManagerWelcomedClub> = {};
  for (const [clubId, entry] of Object.entries(welcomedRaw)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Partial<ClubManagerWelcomedClub>;
    if (typeof row.runClubName !== 'string' || !row.runClubName.trim()) continue;
    welcomed[clubId] = {
      runClubSlug: typeof row.runClubSlug === 'string' ? row.runClubSlug : null,
      runClubName: row.runClubName.trim(),
      ackedAt: typeof row.ackedAt === 'string' ? row.ackedAt : new Date(0).toISOString(),
    };
  }

  return { welcomed };
}

export function isClubManagerClubWelcomed(
  state: ClubManagerState | null | undefined,
  runClubId: string
): boolean {
  return Boolean(state?.welcomed?.[runClubId]);
}

export function clubsNeedingManagerWelcome(
  state: ClubManagerState | null | undefined,
  clubs: LeaderContextClub[]
): LeaderContextClub[] {
  return clubs.filter((c) => !isClubManagerClubWelcomed(state, c.runClubId));
}

export function allManagerClubsWelcomed(
  state: ClubManagerState | null | undefined,
  clubs: LeaderContextClub[]
): boolean {
  if (clubs.length === 0) return false;
  return clubs.every((c) => isClubManagerClubWelcomed(state, c.runClubId));
}

export function mergeClubManagerWelcomeAck(
  existing: ClubManagerState | null | undefined,
  clubs: LeaderContextClub[]
): ClubManagerState {
  const base = parseClubManagerState(existing);
  const welcomed = { ...(base.welcomed ?? {}) };
  const now = new Date().toISOString();

  for (const club of clubs) {
    welcomed[club.runClubId] = {
      runClubSlug: club.runClubSlug,
      runClubName: club.runClubName,
      ackedAt: now,
    };
  }

  return { welcomed };
}
