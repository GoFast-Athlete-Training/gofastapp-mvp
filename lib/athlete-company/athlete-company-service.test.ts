import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  slugifyAthleteCompanyName,
  toPublicAthleteCompany,
} from '@/lib/athlete-company/athlete-company-public';

describe('slugifyAthleteCompanyName', () => {
  it('slugifies business names', () => {
    assert.equal(slugifyAthleteCompanyName('DC Endurance Coaching'), 'dc-endurance-coaching');
    assert.equal(slugifyAthleteCompanyName('  '), 'company');
  });
});

describe('toPublicAthleteCompany', () => {
  it('returns null when name is empty', () => {
    assert.equal(toPublicAthleteCompany(null), null);
    assert.equal(
      toPublicAthleteCompany({
        id: '1',
        athleteId: 'a',
        name: '   ',
        slug: null,
        logoUrl: null,
        websiteUrl: null,
      }),
      null
    );
  });

  it('maps public fields', () => {
    assert.deepEqual(
      toPublicAthleteCompany({
        id: '1',
        athleteId: 'a',
        name: ' Pace Lab ',
        slug: 'pace-lab',
        logoUrl: 'https://example.com/logo.png',
        websiteUrl: 'https://pacelab.com',
      }),
      {
        name: 'Pace Lab',
        slug: 'pace-lab',
        logoUrl: 'https://example.com/logo.png',
        websiteUrl: 'https://pacelab.com',
      }
    );
  });
});
