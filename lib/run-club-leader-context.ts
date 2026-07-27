import { listLeaderMemberships } from '@/lib/run-club-leader-auth';

export type LeaderContextClub = {
  runClubId: string;
  runClubSlug: string | null;
  runClubName: string;
  logoUrl: string | null;
  city: string | null;
  state: string | null;
  role: 'manager' | 'admin';
};

export type LeaderContext = {
  isClubLeader: boolean;
  clubs: LeaderContextClub[];
};

/**
 * Manager context from active write memberships (source of truth for Manage-as-home).
 */
export async function buildLeaderContext(athleteId: string): Promise<LeaderContext | null> {
  const rows = await listLeaderMemberships(athleteId);
  if (rows.length === 0) {
    return null;
  }

  const clubs: LeaderContextClub[] = rows.map((m) => ({
    runClubId: m.run_clubs.id,
    runClubSlug: m.run_clubs.slug,
    runClubName: m.run_clubs.name,
    logoUrl: m.run_clubs.logoUrl,
    city: m.run_clubs.city,
    state: m.run_clubs.state,
    role: m.role as 'manager' | 'admin',
  }));

  return { isClubLeader: true, clubs };
}
