import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateInviteToken,
  hashInviteToken,
  buildClubManagerActivateUrl,
} from './run-club-leader-invite-token';

describe('run-club-leader-invite-token', () => {
  it('hashes tokens deterministically', () => {
    const token = 'test-token-value';
    assert.equal(hashInviteToken(token), hashInviteToken(token));
  });

  it('generates unique tokens', () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    assert.notEqual(a, b);
  });

  it('builds activation URL with encoded token', () => {
    const url = buildClubManagerActivateUrl('abc/def', 'https://app.example.com');
    assert.match(url, /^https:\/\/app\.example\.com\/club-manager\/activate\?token=/);
  });
});
