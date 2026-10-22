import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAthleteEmail, splitDisplayName } from './athlete-email-normalize';

describe('normalizeAthleteEmail', () => {
  it('lowercases and trims', () => {
    assert.equal(normalizeAthleteEmail('  Ada@X.com '), 'ada@x.com');
  });
  it('returns null for empty', () => {
    assert.equal(normalizeAthleteEmail('   '), null);
  });
});

describe('splitDisplayName', () => {
  it('splits first and last', () => {
    assert.deepEqual(splitDisplayName('Ada Lovelace'), {
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
  });
});
