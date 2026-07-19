import { describe, expect, it } from 'vitest';
import { isClubManagerWriteRole, pickLeaderFields } from './run-club-leader-scope';

describe('run-club-leader-scope', () => {
  it('recognizes manager, admin, and legacy owner as write roles', () => {
    expect(isClubManagerWriteRole('manager')).toBe(true);
    expect(isClubManagerWriteRole('admin')).toBe(true);
    expect(isClubManagerWriteRole('owner')).toBe(true);
    expect(isClubManagerWriteRole('member')).toBe(false);
    expect(isClubManagerWriteRole(null)).toBe(false);
  });

  it('pickLeaderFields strips staff-only keys', () => {
    const body = {
      description: 'Weekly group runs',
      slug: 'evil-slug-change',
      staffNotes: 'internal',
    };
    const picked = pickLeaderFields(body, ['description', 'allRunsDescription']);
    expect(picked).toEqual({ description: 'Weekly group runs' });
    expect(picked).not.toHaveProperty('slug');
    expect(picked).not.toHaveProperty('staffNotes');
  });
});
