import { describe, expect, it } from 'vitest';
import { resolveClubManagerHomePath } from './club-manager-home-route';

describe('resolveClubManagerHomePath', () => {
  it('returns null when no clubs', () => {
    expect(resolveClubManagerHomePath([])).toBeNull();
    expect(resolveClubManagerHomePath(undefined)).toBeNull();
  });

  it('returns single club manage path', () => {
    expect(
      resolveClubManagerHomePath([
        {
          runClubId: 'id-1',
          runClubSlug: 'dc-road-runners',
          runClubName: 'DC Road Runners',
          logoUrl: null,
          city: 'DC',
          state: 'DC',
          role: 'manager',
        },
      ])
    ).toBe('/club-manager/runclub/dc-road-runners');
  });

  it('falls back to club id when slug missing', () => {
    expect(
      resolveClubManagerHomePath([
        {
          runClubId: 'id-1',
          runClubSlug: null,
          runClubName: 'Club',
          logoUrl: null,
          city: null,
          state: null,
          role: 'admin',
        },
      ])
    ).toBe('/club-manager/runclub/id-1');
  });

  it('returns hub for multiple clubs', () => {
    expect(
      resolveClubManagerHomePath([
        {
          runClubId: 'a',
          runClubSlug: 'a-club',
          runClubName: 'A',
          logoUrl: null,
          city: null,
          state: null,
          role: 'manager',
        },
        {
          runClubId: 'b',
          runClubSlug: 'b-club',
          runClubName: 'B',
          logoUrl: null,
          city: null,
          state: null,
          role: 'manager',
        },
      ])
    ).toBe('/club-manager');
  });
});
