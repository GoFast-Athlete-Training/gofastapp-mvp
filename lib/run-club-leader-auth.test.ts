import { describe, expect, it } from 'vitest';
import { isRunClubLeaderRole, pickLeaderFields } from './run-club-leader-scope';

describe('run-club-leader-scope', () => {
  it('recognizes owner and admin as leader roles', () => {
    expect(isRunClubLeaderRole('owner')).toBe(true);
    expect(isRunClubLeaderRole('admin')).toBe(true);
    expect(isRunClubLeaderRole('member')).toBe(false);
    expect(isRunClubLeaderRole(null)).toBe(false);
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
