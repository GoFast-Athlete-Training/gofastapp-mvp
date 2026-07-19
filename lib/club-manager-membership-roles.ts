/**
 * Club Manager membership roles (prod `run_club_memberships.role`).
 *
 * Canonical (new invites):
 * - manager — manage club profile, runs, series, announcements
 * - admin — manager + destructive ops (e.g. delete club)
 *
 * Legacy rows may still store owner | admin (old model). Read helpers normalize both.
 */

export const CLUB_MANAGER_WRITE_ROLES = ['manager', 'admin'] as const;
export type ClubManagerWriteRole = (typeof CLUB_MANAGER_WRITE_ROLES)[number];

const LEGACY_WRITE_ROLES = ['owner', 'admin'] as const;

/** Normalize Company/invite input to canonical manager | admin. */
export function normalizeClubManagerRole(
  role: string | null | undefined,
  defaultRole: ClubManagerWriteRole = 'manager'
): ClubManagerWriteRole {
  const n = (role ?? '').trim().toLowerCase();
  if (n === 'admin' || n.includes('delete') || n.includes('full')) {
    return 'admin';
  }
  if (n === 'owner' || n.includes('owner')) {
    return 'admin';
  }
  if (n === 'manager' || n.includes('manager')) {
    return 'manager';
  }
  return defaultRole;
}

/** Whether role grants club manager write APIs (includes legacy owner/admin). */
export function isClubManagerWriteRole(role: string | null | undefined): boolean {
  const n = (role ?? '').trim().toLowerCase();
  return (
    n === 'manager' ||
    n === 'admin' ||
    n === 'owner' ||
    LEGACY_WRITE_ROLES.includes(n as (typeof LEGACY_WRITE_ROLES)[number])
  );
}

/** Destructive tier: canonical admin, or legacy owner. Legacy admin is manager-tier only. */
export function isClubManagerAdminRole(role: string | null | undefined): boolean {
  const n = (role ?? '').trim().toLowerCase();
  if (n === 'admin') return true;
  if (n === 'owner') return true;
  return false;
}

export function formatClubManagerRoleLabel(role: string | null | undefined): string {
  if (isClubManagerAdminRole(role)) {
    return 'Club admin';
  }
  if (isClubManagerWriteRole(role)) {
    return 'Club manager';
  }
  return 'Club manager';
}

/** Role string persisted on new invite seeds and membership writes. */
export function canonicalClubManagerRoleForStorage(
  role: string | null | undefined,
  defaultRole: ClubManagerWriteRole = 'manager'
): ClubManagerWriteRole {
  return normalizeClubManagerRole(role, defaultRole);
}
