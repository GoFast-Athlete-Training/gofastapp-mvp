import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterDoorCalendarRaces,
  resolveDoorGoalRace,
} from '@/lib/gofast-with-me/public-door-sidebar';

describe('resolveDoorGoalRace', () => {
  const signups = [
    {
      id: 'reg-mcm',
      athleteRaceId: 'ar-mcm',
      name: 'Marine Corps Marathon',
      raceDate: '2026-10-25T12:00:00.000Z',
      distanceLabel: 'Marathon',
      slug: 'mcm',
    },
    {
      id: 'reg-boston',
      athleteRaceId: 'ar-boston',
      name: 'Boston Marathon',
      raceDate: '2027-04-20T12:00:00.000Z',
      distanceLabel: 'Marathon',
      slug: 'boston',
    },
  ];

  it('prefers goal athleteRaceId over plan primary', () => {
    const goal = resolveDoorGoalRace({
      primaryChasingGoal: {
        athleteRaceId: 'ar-mcm',
        raceName: 'Marine Corps Marathon',
        raceDate: '2026-10-25T12:00:00.000Z',
      },
      trainingSummary: {
        primaryAthleteRaceId: 'ar-boston',
        raceName: 'Boston Marathon',
        raceDate: '2027-04-20T12:00:00.000Z',
      },
      signedUpRaces: signups,
    });
    assert.equal(goal?.athleteRaceId, 'ar-mcm');
    assert.equal(goal?.name, 'Marine Corps Marathon');
  });

  it('falls back to plan primaryAthleteRaceId', () => {
    const goal = resolveDoorGoalRace({
      primaryChasingGoal: null,
      trainingSummary: {
        primaryAthleteRaceId: 'ar-boston',
        raceName: 'Boston Marathon',
        raceDate: '2027-04-20T12:00:00.000Z',
      },
      signedUpRaces: signups,
    });
    assert.equal(goal?.athleteRaceId, 'ar-boston');
  });
});

describe('filterDoorCalendarRaces', () => {
  const signups = [
    {
      id: 'reg-mcm',
      athleteRaceId: 'ar-mcm',
      name: 'Marine Corps Marathon',
      raceDate: '2026-10-25T12:00:00.000Z',
      distanceLabel: 'Marathon',
    },
    {
      id: 'reg-boston',
      athleteRaceId: 'ar-boston',
      name: 'Boston Marathon',
      raceDate: '2027-04-20T12:00:00.000Z',
      distanceLabel: 'Marathon',
    },
  ];

  it('drops the goal race from calendar', () => {
    const goal = {
      athleteRaceId: 'ar-mcm',
      name: 'Marine Corps Marathon',
      raceDate: '2026-10-25T12:00:00.000Z',
      distanceLabel: 'Marathon',
      slug: null,
      city: null,
      state: null,
    };
    const filtered = filterDoorCalendarRaces(
      signups,
      goal,
      new Date('2026-01-01T00:00:00.000Z')
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.athleteRaceId, 'ar-boston');
  });
});
