import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isRunStillUpcomingForDiscover,
  runCalendarStartMs,
  SAME_DAY_RUN_START_GRACE_MS,
  zonedLocalWallClockToUtcMs,
} from './run-discover-freshness';

test('runCalendarStartMs uses run timezone for wall-clock start (Eastern)', () => {
  const ms = runCalendarStartMs({
    date: new Date('2026-07-01T00:00:00.000Z'),
    startTimeHour: 6,
    startTimeMinute: 15,
    startTimePeriod: 'AM',
    timezone: 'America/New_York',
  });
  assert.ok(ms);
  const d = new Date(ms!);
  // July 1 2026 is EDT (UTC-4): 6:15 AM ET = 10:15 UTC
  assert.equal(d.getUTCHours(), 10);
  assert.equal(d.getUTCMinutes(), 15);
});

test('zonedLocalWallClockToUtcMs resolves Eastern morning runs', () => {
  const ms = zonedLocalWallClockToUtcMs(2026, 7, 8, 6, 15, 'America/New_York');
  const d = new Date(ms);
  assert.equal(d.getUTCHours(), 10);
  assert.equal(d.getUTCMinutes(), 15);
});

test('same-day run without start time stays visible all day in run timezone', () => {
  const runDate = new Date('2026-07-01T12:00:00.000Z');
  const now = new Date('2026-07-01T22:00:00.000Z');
  assert.equal(
    isRunStillUpcomingForDiscover(
      {
        date: runDate,
        startTimeHour: null,
        startTimeMinute: null,
        startTimePeriod: null,
        timezone: 'America/New_York',
      },
      now
    ),
    true
  );
});

test('same-day run hides after local start time plus grace window', () => {
  const runDate = new Date('2026-07-01T00:00:00.000Z');
  const run = {
    date: runDate,
    startTimeHour: 6,
    startTimeMinute: 15,
    startTimePeriod: 'AM',
    timezone: 'America/New_York',
  };
  const startMs = runCalendarStartMs(run)!;
  const beforeGrace = new Date(startMs + SAME_DAY_RUN_START_GRACE_MS - 60_000);
  const afterGrace = new Date(startMs + SAME_DAY_RUN_START_GRACE_MS + 60_000);

  assert.equal(isRunStillUpcomingForDiscover(run, beforeGrace), true);
  assert.equal(isRunStillUpcomingForDiscover(run, afterGrace), false);
});

test('Ballston-style morning run stays visible at 6:30 AM Eastern same day', () => {
  const run = {
    date: new Date('2026-07-08T00:00:00.000Z'),
    startTimeHour: 6,
    startTimeMinute: 15,
    startTimePeriod: 'AM',
    timezone: 'America/New_York',
  };
  // 6:30 AM ET on Jul 8 2026 = 10:30 UTC (still within 30m grace after 6:15 AM start)
  const sixThirtyAmEastern = new Date('2026-07-08T10:30:00.000Z');
  assert.equal(isRunStillUpcomingForDiscover(run, sixThirtyAmEastern), true);

  // 7:00 AM ET is after grace window — should drop off
  const sevenAmEastern = new Date('2026-07-08T11:00:00.000Z');
  assert.equal(isRunStillUpcomingForDiscover(run, sevenAmEastern), false);
});

test('future calendar day runs always stay visible', () => {
  const run = {
    date: new Date('2026-07-02T00:00:00.000Z'),
    startTimeHour: 6,
    startTimeMinute: 0,
    startTimePeriod: 'AM',
    timezone: 'America/New_York',
  };
  const now = new Date('2026-07-01T22:00:00.000Z');
  assert.equal(isRunStillUpcomingForDiscover(run, now), true);
});
