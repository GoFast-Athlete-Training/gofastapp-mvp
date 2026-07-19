import { describe, expect, it } from 'vitest';
import {
  canonicalClubManagerRoleForStorage,
  formatClubManagerRoleLabel,
  isClubManagerAdminRole,
  isClubManagerWriteRole,
  normalizeClubManagerRole,
} from './club-manager-membership-roles';

describe('club-manager-membership-roles', () => {
  it('defaults invites to manager', () => {
    expect(normalizeClubManagerRole(null)).toBe('manager');
    expect(normalizeClubManagerRole('')).toBe('manager');
  });

  it('maps admin and legacy owner to admin tier', () => {
    expect(normalizeClubManagerRole('admin')).toBe('admin');
    expect(normalizeClubManagerRole('owner')).toBe('admin');
    expect(normalizeClubManagerRole('Club Owner')).toBe('admin');
  });

  it('maps manager input to manager tier', () => {
    expect(normalizeClubManagerRole('manager')).toBe('manager');
  });

  it('recognizes write roles including legacy', () => {
    expect(isClubManagerWriteRole('manager')).toBe(true);
    expect(isClubManagerWriteRole('admin')).toBe(true);
    expect(isClubManagerWriteRole('owner')).toBe(true);
    expect(isClubManagerWriteRole('member')).toBe(false);
  });

  it('admin tier for destructive ops', () => {
    expect(isClubManagerAdminRole('admin')).toBe(true);
    expect(isClubManagerAdminRole('owner')).toBe(true);
    expect(isClubManagerAdminRole('manager')).toBe(false);
  });

  it('formats labels', () => {
    expect(formatClubManagerRoleLabel('manager')).toBe('Club manager');
    expect(formatClubManagerRoleLabel('admin')).toBe('Club admin');
  });

  it('storage uses canonical roles', () => {
    expect(canonicalClubManagerRoleForStorage('owner')).toBe('admin');
    expect(canonicalClubManagerRoleForStorage(undefined)).toBe('manager');
  });
});
