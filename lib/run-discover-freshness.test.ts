import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isRunStillUpcomingForDiscover,
  runCalendarStartMs,
  SAME_DAY_RUN_START_GRACE_MS,
} from './run-discover-freshness';

test('runCalendarStartMs builds UTC timestamp from calendar date and AM/PM time', () => {
  const ms = runCalendarStartMs({
    date: new Date('2026-07-01T00:00:00.000Z'),
    startTimeHour: 6,
    startTimeMinute: 15,
    startTimePeriod: 'AM',
  });
  assert.ok(ms);
  const d = new Date(ms!);
  assert.equal(d.getUTCHours(), 6);
  assert.equal(d.getUTCMinutes(), 15);
});

test('same-day run without start time stays visible all day', () => {
  const runDate = new Date('2026-07-01T12:00:00.000Z');
  const now = new Date('2026-07-01T22:00:00.000Z');
  assert.equal(
    isRunStillUpcomingForDiscover(
      {
        date: runDate,
        startTimeHour: null,
        startTimeMinute: null,
        startTimePeriod: null,
      },
      now
    ),
    true
  );
});

test('same-day run hides after start time plus grace window', () => {
  const runDate = new Date('2026-07-01T00:00:00.000Z');
  const startMs = runCalendarStartMs({
    date: runDate,
    startTimeHour: 6,
    startTimeMinute: 15,
    startTimePeriod: 'AM',
  })!;
  const beforeGrace = new Date(startMs + SAME_DAY_RUN_START_GRACE_MS - 60_000);
  const afterGrace = new Date(startMs + SAME_DAY_RUN_START_GRACE_MS + 60_000);

  const run = {
    date: runDate,
    startTimeHour: 6,
    startTimeMinute: 15,
    startTimePeriod: 'AM',
  };

  assert.equal(isRunStillUpcomingForDiscover(run, beforeGrace), true);
  assert.equal(isRunStillUpcomingForDiscover(run, afterGrace), false);
});

test('future calendar day runs always stay visible', () => {
  const run = {
    date: new Date('2026-07-02T00:00:00.000Z'),
    startTimeHour: 6,
    startTimeMinute: 0,
    startTimePeriod: 'AM',
  };
  const now = new Date('2026-07-01T22:00:00.000Z');
  assert.equal(isRunStillUpcomingForDiscover(run, now), true);
});
