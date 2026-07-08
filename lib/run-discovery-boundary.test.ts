import test from 'node:test';
import assert from 'node:assert/strict';

import { isRunStillUpcomingForDiscover } from './run-discover-freshness';

/**
 * Regression: Ballston-style runs must stay discoverable through local morning start + grace
 * even when `published=false` would exclude them from `/api/runs/public`.
 */
test('unpublished morning club run stays discoverable before local grace cutoff', () => {
  const run = {
    date: new Date('2026-07-08T00:00:00.000Z'),
    startTimeHour: 6,
    startTimeMinute: 15,
    startTimePeriod: 'AM',
    timezone: 'America/New_York',
  };

  // Simulates "now" at 6:20 AM Eastern — public SEO list may still filter published=false,
  // but discovery freshness should keep the run visible.
  const sixTwentyAmEastern = new Date('2026-07-08T10:20:00.000Z');
  assert.equal(isRunStillUpcomingForDiscover(run, sixTwentyAmEastern), true);
});
