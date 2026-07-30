import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLUB_MANAGER_PRODUCTION_URL,
  getClubManagerAppUrl,
} from './club-manager-public-url';
import { buildClubManagerActivateUrl } from './run-club-leader-invite-token';

describe('club-manager-public-url', () => {
  it('prefers CLUB_MANAGER_APP_URL env override', () => {
    const prev = process.env.CLUB_MANAGER_APP_URL;
    process.env.CLUB_MANAGER_APP_URL = CLUB_MANAGER_PRODUCTION_URL;
    try {
      assert.equal(getClubManagerAppUrl(), CLUB_MANAGER_PRODUCTION_URL);
      const url = buildClubManagerActivateUrl('abc123');
      assert.match(
        url,
        /^https:\/\/clubmanage\.gofastcrushgoals\.com\/club-manager\/activate\?token=/
      );
    } finally {
      if (prev === undefined) delete process.env.CLUB_MANAGER_APP_URL;
      else process.env.CLUB_MANAGER_APP_URL = prev;
    }
  });
});
