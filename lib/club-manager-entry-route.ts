import { resolveClubManagerHomePath } from '@/lib/club-manager-home-route';
import {
  clubManagerActivatePath,
  clubManagerClubPath,
  clubManagerHubPath,
} from '@/lib/club-manager-paths';
import { LocalStorageAPI } from '@/lib/localstorage';
import type { LeaderContextClub } from '@/lib/run-club-leader-context';

/**
 * Where to send someone entering Club Manager with no active session context.
 * Authority: run_club_memberships (leaderContext). First-time confirm happens in ClubManagerShell.
 */
export function resolveClubManagerEntryPath(input: {
  clubs?: LeaderContextClub[] | null;
  redirect?: string | null;
}): string {
  const clubs = input.clubs ?? [];

  if (clubs.length > 0) {
    LocalStorageAPI.clearClubManagerActivationToken();
    return resolveClubManagerHomePath(clubs) ?? clubManagerHubPath();
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
