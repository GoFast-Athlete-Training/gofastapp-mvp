import assert from 'node:assert/strict';
import test from 'node:test';
import { composeHubStreamFeed } from './hub-stream-feed';

test('composeHubStreamFeed merges activities and daily logs without check-ins', () => {
  const feed = composeHubStreamFeed({
    updateMessages: [
      {
        id: 'm1',
        body: 'Legs feel good',
        topic: 'updates',
        createdAt: '2026-08-10T12:00:00.000Z',
        author: {
          id: 'a1',
          firstName: 'Adam',
          lastName: null,
          photoURL: null,
          gofastHandle: 'adam',
        },
        cityRun: null,
      },
    ],
    recentActivities: [
      {
        id: 'act1',
        activityName: 'Morning Run',
        activityType: 'Run',
        startTime: '2026-08-16T07:00:00.000Z',
        distanceMiles: 6.2,
        durationSeconds: 3180,
        source: 'garmin',
        summaryPolyline: null,
        startLatitude: null,
        startLongitude: null,
        endLatitude: null,
        endLongitude: null,
        matchedWorkout: {
          id: 'w1',
          title: 'Easy 6',
          workoutType: 'EasyRun',
          planName: 'Marathon Block',
          workoutDate: '2026-08-16T07:00:00.000Z',
          publicTitle: 'Easy miles before work',
          reflection: 'Felt smooth',
          workoutPhotoUrl: null,
        },
      },
    ],
    attendedClubRuns: [
      {
        id: 'c1',
        runId: 'run1',
        title: 'Thurs Tempo',
        label: 'DCCR Thurs Tempo',
        checkedInAt: '2026-08-14T18:00:00.000Z',
        meetUpPoint: 'Memorial',
      },
    ],
  });

  assert.equal(feed.length, 2);
  assert.equal(feed[0]?.kind, 'activity');
  assert.equal(feed[1]?.kind, 'dailylog');
  if (feed[0]?.kind === 'activity') {
    assert.equal(feed[0].headline, 'Easy miles before work');
    assert.equal(feed[0].activityId, 'act1');
    assert.equal(feed[0].reflection, 'Felt smooth');
  }
});

test('composeHubStreamFeed strips planned distance from headline when actual miles exist', () => {
  const feed = composeHubStreamFeed({
    updateMessages: [],
    recentActivities: [
      {
        id: 'act2',
        activityName: 'Long Run',
        activityType: 'Run',
        startTime: '2026-09-05T07:00:00.000Z',
        distanceMiles: 18.6,
        durationSeconds: 54000,
        source: 'garmin',
        summaryPolyline: null,
        startLatitude: null,
        startLongitude: null,
        endLatitude: null,
        endLongitude: null,
        matchedWorkout: {
          id: 'w2',
          title: 'Saturday Long run - 19.6 Miles',
          workoutType: 'LongRun',
          planName: 'Marathon Block',
          workoutDate: '2026-09-05T07:00:00.000Z',
          publicTitle: null,
          reflection: null,
          workoutPhotoUrl: null,
        },
      },
    ],
  });

  assert.equal(feed.length, 1);
  if (feed[0]?.kind === 'activity') {
    assert.equal(feed[0].headline, 'Saturday Long run');
  }
});
