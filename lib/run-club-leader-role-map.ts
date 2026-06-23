import type { RunClubLeaderRole } from '@/lib/run-club-leader-scope';

/**
 * v1 role mapping from Company acq_club_leaders.role (free string) → prod membership role.
 *
 * Decision: default `admin` for all seeded leaders. Use `owner` only when Company role
 * explicitly contains "owner" (case-insensitive). Both pass requireRunClubLeader writes.
 */
export function mapAcqRoleToMembershipRole(acqRole: string | null | undefined): RunClubLeaderRole {
  const normalized = (acqRole ?? '').trim().toLowerCase();
  if (normalized.includes('owner')) {
    return 'owner';
  }
  return 'admin';
}

export function normalizeLeaderEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}
