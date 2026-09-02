import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildActivityHistoryWhere,
  computeWeekStats,
  decodeActivityHistoryCursor,
  encodeActivityHistoryCursor,
  mapActivityHistoryRow,
  parseActivityHistoryFilter,
} from './activity-history';

test('parseActivityHistoryFilter accepts unmatched only', () => {
  assert.equal(parseActivityHistoryFilter(null), 'all');
  assert.equal(parseActivityHistoryFilter('unmatched'), 'unmatched');
  assert.equal(parseActivityHistoryFilter('all'), 'all');
});

test('activity history cursor roundtrip', () => {
  const cursor = encodeActivityHistoryCursor({
    id: 'act-1',
    startTime: new Date('2026-08-29T12:00:00.000Z'),
  });
  assert.ok(cursor);
  const decoded = decodeActivityHistoryCursor(cursor);
  assert.deepEqual(decoded, {
    id: 'act-1',
    startTime: '2026-08-29T12:00:00.000Z',
  });
});

test('buildActivityHistoryWhere adds unmatched filter', () => {
  const where = buildActivityHistoryWhere({
    athleteId: 'a1',
    filter: 'unmatched',
    from: null,
    to: null,
    cursor: null,
  });
  assert.deepEqual(where, {
    AND: [{ athleteId: 'a1' }, { garmin_detail_workout: { is: null } }],
  });
});

test('mapActivityHistoryRow includes matched workout context', () => {
  const row = mapActivityHistoryRow({
    id: 'act-1',
    sourceActivityId: 'src-1',
    source: 'garmin',
    ingestionStatus: 'MATCHED',
    activityType: 'running',
    activityName: 'Morning Run',
    startTime: new Date('2026-08-29T12:00:00.000Z'),
    duration: 3600,
    distance: 10000,
    calories: 600,
    averageSpeed: 2.7,
    averageHeartRate: 140,
    elevationGain: 50,
    garmin_detail_workout: {
      id: 'w1',
      title: 'Easy 6',
      workoutType: 'EasyRun',
      communityPublishedAt: new Date('2026-08-29T13:00:00.000Z'),
      training_plans: { name: 'Marathon Block' },
    },
  });
  assert.equal(row.matchedWorkoutId, 'w1');
  assert.equal(row.matchedPlanName, 'Marathon Block');
  assert.equal(row.communityPublishedAt, '2026-08-29T13:00:00.000Z');
});

test('computeWeekStats aggregates loaded week items', () => {
  const stats = computeWeekStats([
    {
      id: '1',
      sourceActivityId: 's1',
      source: 'garmin',
      ingestionStatus: 'MATCHED',
      activityType: 'running',
      activityName: 'Run',
      startTime: '2026-08-29T12:00:00.000Z',
      duration: 3600,
      distance: 1609.34,
      calories: 400,
      averageSpeed: null,
      averageHeartRate: null,
      elevationGain: null,
      matchedWorkoutId: null,
      matchedWorkoutTitle: null,
      matchedWorkoutType: null,
      matchedPlanName: null,
      communityPublishedAt: null,
    },
  ]);
  assert.equal(stats.activities, 1);
  assert.ok(Math.abs(stats.miles - 1) < 0.01);
});
