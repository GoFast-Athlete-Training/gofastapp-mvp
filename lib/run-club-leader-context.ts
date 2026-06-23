import { listLeaderMemberships } from '@/lib/run-club-leader-auth';

export type LeaderContextClub = {
  runClubId: string;
  runClubSlug: string | null;
  runClubName: string;
  logoUrl: string | null;
  city: string | null;
  state: string | null;
  role: 'owner' | 'admin';
};

export type LeaderContext = {
  isClubLeader: boolean;
  clubs: LeaderContextClub[];
};

/**
 * Compact leader context for athlete profile/bootstrap.
 * `Athlete.role` gates whether we compute this; membership rows gate write access.
 */
export async function buildLeaderContext(
  athleteId: string,
  athleteRole: string | null | undefined
): Promise<LeaderContext | null> {
  const isClubLeader = athleteRole === 'CLUB_LEADER';
  if (!isClubLeader) {
    return null;
  }

  const rows = await listLeaderMemberships(athleteId);
  const clubs: LeaderContextClub[] = rows.map((m) => ({
    runClubId: m.run_clubs.id,
    runClubSlug: m.run_clubs.slug,
    runClubName: m.run_clubs.name,
    logoUrl: m.run_clubs.logoUrl,
    city: m.run_clubs.city,
    state: m.run_clubs.state,
    role: m.role as 'owner' | 'admin',
  }));

  return { isClubLeader: true, clubs };
}
