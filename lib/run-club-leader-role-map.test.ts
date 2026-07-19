import { describe, expect, it } from 'vitest';
import { mapAcqRoleToMembershipRole, normalizeLeaderEmail } from './run-club-leader-role-map';

describe('run-club-leader-role-map', () => {
  it('defaults to manager', () => {
    expect(mapAcqRoleToMembershipRole(null)).toBe('manager');
    expect(mapAcqRoleToMembershipRole('Director')).toBe('manager');
  });

  it('maps owner to admin tier', () => {
    expect(mapAcqRoleToMembershipRole('Club Owner')).toBe('admin');
    expect(mapAcqRoleToMembershipRole('co-owner')).toBe('admin');
  });

  it('maps explicit admin to admin tier', () => {
    expect(mapAcqRoleToMembershipRole('admin')).toBe('admin');
  });

  it('normalizes email', () => {
    expect(normalizeLeaderEmail('  Leader@Club.COM ')).toBe('leader@club.com');
    expect(normalizeLeaderEmail('')).toBeNull();
  });
});
