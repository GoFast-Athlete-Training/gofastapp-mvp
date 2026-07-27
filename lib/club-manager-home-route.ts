import { clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';
import type { LeaderContextClub } from '@/lib/run-club-leader-context';

/** Default post-login landing for athletes with club manager write memberships. */
export function resolveClubManagerHomePath(
  clubs: LeaderContextClub[] | null | undefined
): string | null {
  if (!clubs?.length) return null;
  if (clubs.length === 1) {
    const club = clubs[0]!;
    return clubManagerClubPath(club.runClubSlug ?? club.runClubId);
  }
  return clubManagerHubPath();
}

export function athleteHasManagerMemberships(
  clubs: LeaderContextClub[] | null | undefined
): boolean {
  return (clubs?.length ?? 0) > 0;
}
