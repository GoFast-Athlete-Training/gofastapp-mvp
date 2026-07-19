import type { RunClubLeaderRole } from '@/lib/run-club-leader-scope';
import { normalizeClubManagerRole } from '@/lib/club-manager-membership-roles';

/**
 * Map Company acq_club_leaders.role (free string) → prod membership role.
 * Default manager; explicit owner/admin/delete → admin tier.
 */
export function mapAcqRoleToMembershipRole(acqRole: string | null | undefined): RunClubLeaderRole {
  return normalizeClubManagerRole(acqRole, 'manager');
}

export function normalizeLeaderEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}
