import { resolveClubManagerHomePath } from '@/lib/club-manager-home-route';
import {
  clubManagerActivatePath,
  clubManagerClubPath,
  clubManagerHubPath,
  clubManagerWelcomePath,
} from '@/lib/club-manager-paths';
import {
  allManagerClubsWelcomed,
  parseClubManagerState,
} from '@/lib/club-manager-state';
import { LocalStorageAPI } from '@/lib/localstorage';
import type { LeaderContextClub } from '@/lib/run-club-leader-context';

/**
 * Where to send someone entering Club Manager.
 * Authority: run_club_memberships (leaderContext). Welcome is first-ack only (clubManagerState).
 */
export function resolveClubManagerEntryPath(input: {
  clubs?: LeaderContextClub[] | null;
  clubManagerState?: unknown;
  redirect?: string | null;
}): string {
  const clubs = input.clubs ?? [];

  if (clubs.length > 0) {
    LocalStorageAPI.clearClubManagerActivationToken();

    const state = parseClubManagerState(input.clubManagerState);
    if (allManagerClubsWelcomed(state, clubs)) {
      return resolveClubManagerHomePath(clubs) ?? clubManagerHubPath();
    }

    return clubManagerWelcomePath();
  }

  const token = LocalStorageAPI.getClubManagerActivationToken();
  if (token) {
    return clubManagerActivatePath(token);
  }

  const redirect = input.redirect?.trim();
  if (redirect) {
    return redirect;
  }

  return clubManagerHubPath();
}

/** Write membership exists for this club (not welcome ack). */
export function managerAlreadyActiveForClub(
  clubs: LeaderContextClub[] | null | undefined,
  runClubId: string
): boolean {
  return (clubs ?? []).some((c) => c.runClubId === runClubId);
}

export function clubManagerPathForClub(clubs: LeaderContextClub[], runClubId: string): string | null {
  const club = clubs.find((c) => c.runClubId === runClubId);
  if (!club) return null;
  return clubManagerClubPath(club.runClubSlug ?? club.runClubId);
}
