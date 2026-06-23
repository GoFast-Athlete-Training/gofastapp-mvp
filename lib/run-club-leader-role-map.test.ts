import { describe, expect, it } from 'vitest';
import { mapAcqRoleToMembershipRole, normalizeLeaderEmail } from './run-club-leader-role-map';

describe('run-club-leader-role-map', () => {
  it('defaults to admin', () => {
    expect(mapAcqRoleToMembershipRole(null)).toBe('admin');
    expect(mapAcqRoleToMembershipRole('Director')).toBe('admin');
  });

  it('maps owner when acq role contains owner', () => {
    expect(mapAcqRoleToMembershipRole('Club Owner')).toBe('owner');
    expect(mapAcqRoleToMembershipRole('co-owner')).toBe('owner');
  });

  it('normalizes email', () => {
    expect(normalizeLeaderEmail('  Leader@Club.COM ')).toBe('leader@club.com');
    expect(normalizeLeaderEmail('')).toBeNull();
  });
});
