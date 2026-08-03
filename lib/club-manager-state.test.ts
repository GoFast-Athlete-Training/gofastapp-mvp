import { describe, expect, it } from 'vitest';
import {
  allManagerClubsWelcomed,
  clubsNeedingManagerWelcome,
  mergeClubManagerWelcomeAck,
  parseClubManagerState,
} from './club-manager-state';
import type { LeaderContextClub } from './run-club-leader-context';

const clubA: LeaderContextClub = {
  runClubId: 'club-a',
  runClubSlug: 'club-a-slug',
  runClubName: 'Club A',
  logoUrl: null,
  city: null,
  state: null,
  role: 'manager',
};

describe('club-manager-state', () => {
  it('parses welcomed clubs from JSON', () => {
    const state = parseClubManagerState({
      welcomed: {
        'club-a': {
          runClubSlug: 'club-a-slug',
          runClubName: 'Club A',
          ackedAt: '2026-08-03T00:00:00.000Z',
        },
      },
    });
    expect(state.welcomed?.['club-a']?.runClubName).toBe('Club A');
  });

  it('lists clubs needing welcome', () => {
    const state = parseClubManagerState({
      welcomed: { 'club-a': { runClubSlug: null, runClubName: 'Club A', ackedAt: 'x' } },
    });
    const clubB: LeaderContextClub = { ...clubA, runClubId: 'club-b', runClubName: 'Club B' };
    expect(clubsNeedingManagerWelcome(state, [clubA, clubB])).toHaveLength(1);
    expect(clubsNeedingManagerWelcome(state, [clubA, clubB])[0]?.runClubId).toBe('club-b');
  });

  it('merges welcome ack for all clubs', () => {
    const next = mergeClubManagerWelcomeAck({}, [clubA]);
    expect(allManagerClubsWelcomed(next, [clubA])).toBe(true);
  });
});
