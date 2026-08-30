import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRunningSectionItems,
  mapActivityPostsByActivityId,
} from './athlete-community-running-section';
import { sortRunningActivitiesForHub } from './recent-athlete-activities';

describe('mapActivityPostsByActivityId', () => {
  it('indexes posts by activity id', () => {
    const map = mapActivityPostsByActivityId([
      {
        id: 'post-1',
        activityId: 'act-1',
        caption: 'Great run',
        photoUrl: null,
        showMatchedWorkout: false,
        publishedAt: '2026-08-01T00:00:00.000Z',
        activity: {
          activityName: 'Morning Run',
          startTime: '2026-08-01T00:00:00.000Z',
          distanceMiles: 5,
          durationSeconds: 2400,
          activityType: 'run',
        },
        matchedWorkout: null,
      },
    ]);

    assert.equal(map.get('act-1')?.caption, 'Great run');
  });
});

describe('sortRunningActivitiesForHub', () => {
  it('puts today matched workout first', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayIso = today.toISOString();

    const sorted = sortRunningActivitiesForHub([
      {
        id: 'older-unmatched',
        activityName: 'Easy Run',
        activityType: 'RUNNING',
        startTime: '2026-07-01T00:00:00.000Z',
        distanceMiles: 4,
        durationSeconds: 1800,
        source: 'garmin',
        summaryPolyline: null,
        startLatitude: null,
        startLongitude: null,
        endLatitude: null,
        endLongitude: null,
        matchedWorkout: null,
      },
      {
        id: 'today-matched',
        activityName: 'Tempo',
        activityType: 'RUNNING',
        startTime: todayIso,
        distanceMiles: 6,
        durationSeconds: 3000,
        source: 'garmin',
        summaryPolyline: null,
        startLatitude: null,
        startLongitude: null,
        endLatitude: null,
        endLongitude: null,
        matchedWorkout: {
          id: 'w1',
          title: 'Tempo Run',
          workoutType: 'tempo',
          planName: 'Plan',
          workoutDate: todayIso,
          publicTitle: null,
          reflection: null,
          workoutPhotoUrl: null,
        },
      },
    ]);

    assert.equal(sorted[0]?.id, 'today-matched');
  });
});

describe('buildRunningSectionItems', () => {
  it('maps recent activities and enriches matching posts', () => {
    const items = buildRunningSectionItems({
      recentActivities: [
        {
          id: 'act-2',
          activityName: 'Long Run',
          activityType: 'RUNNING',
          startTime: '2026-08-02T00:00:00.000Z',
          distanceMiles: 10,
          durationSeconds: 5400,
          source: 'garmin',
          summaryPolyline: null,
          startLatitude: null,
          startLongitude: null,
          endLatitude: null,
          endLongitude: null,
          matchedWorkout: null,
        },
        {
          id: 'act-1',
          activityName: 'Easy Run',
          activityType: 'RUNNING',
          startTime: '2026-08-01T00:00:00.000Z',
          distanceMiles: 4,
          durationSeconds: 1800,
          source: 'garmin',
          summaryPolyline: null,
          startLatitude: null,
          startLongitude: null,
          endLatitude: null,
          endLongitude: null,
          matchedWorkout: null,
        },
      ],
      activityPosts: [
        {
          id: 'post-1',
          activityId: 'act-1',
          caption: 'Felt smooth',
          photoUrl: null,
          showMatchedWorkout: false,
          publishedAt: '2026-08-01T00:00:00.000Z',
          activity: {
            activityName: 'Easy Run',
            startTime: '2026-08-01T00:00:00.000Z',
            distanceMiles: 4,
            durationSeconds: 1800,
            activityType: 'run',
          },
          matchedWorkout: null,
        },
      ],
    });

    assert.equal(items.length, 2);
    assert.equal(items[0]?.kind, 'activity');
    assert.equal(items[0]?.post, null);
    assert.equal(items[1]?.post?.caption, 'Felt smooth');
  });
});
