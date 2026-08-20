import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPublicTrainingFor } from '@/lib/gofast-with-me/public-training-for';

const mcm = {
  id: 'athlete-race-mcm',
  raceRegistryId: 'registry-mcm',
  name: 'Marine Corps Marathon',
  raceDate: new Date('2026-10-25T12:00:00.000Z'),
  city: 'Arlington',
  state: 'VA',
  distanceLabel: 'Marathon',
  distanceMeters: 42195,
  slug: 'marine-corps-marathon',
  logoUrl: 'https://example.com/mcm.png',
};

const goal = {
  id: 'goal-mcm',
  name: 'Break 3:05',
  distance: 'Marathon',
  goalTime: '3:05:00',
  targetByDate: new Date('2026-10-25T12:00:00.000Z'),
};

describe('buildPublicTrainingFor', () => {
  it('hydrates the public declaration from athlete-scoped snapshots', () => {
    const result = buildPublicTrainingFor({
      goal,
      athleteRace: mcm,
      publicPlans: [
        {
          id: 'plan-mcm',
          athleteRaceId: mcm.id,
          name: 'MCM 3:05 Build',
          publicSlug: 'mcm-305-build',
          publicDescription: null,
          totalWeeks: 18,
        },
      ],
    });

    assert.equal(result?.athleteRace.athleteRaceId, mcm.id);
    assert.equal(result?.athleteRace.slug, mcm.slug);
    assert.equal(result?.goal.goalTime, '3:05:00');
    assert.equal(result?.publicPlan?.slug, 'mcm-305-build');
  });

  it('does not attach a public plan for a different athlete race', () => {
    const result = buildPublicTrainingFor({
      goal,
      athleteRace: mcm,
      publicPlans: [
        {
          id: 'plan-other',
          athleteRaceId: 'athlete-race-boston',
          name: 'Boston Build',
          publicSlug: 'boston-build',
          publicDescription: null,
          totalWeeks: 16,
        },
      ],
    });

    assert.equal(result?.publicPlan, null);
  });

  it('returns no race card for a goal without an athlete race', () => {
    const result = buildPublicTrainingFor({
      goal,
      athleteRace: null,
      publicPlans: [],
    });

    assert.equal(result, null);
  });
});
