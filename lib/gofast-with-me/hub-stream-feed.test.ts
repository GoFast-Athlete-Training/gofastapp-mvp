import assert from 'node:assert/strict';
import test from 'node:test';
import { composeHubStreamFeed } from './hub-stream-feed';

test('composeHubStreamFeed merges activities, daily logs, and attended club runs', () => {
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
          reflection: 'Should not appear in hub feed',
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

  assert.equal(feed.length, 3);
  assert.equal(feed[0]?.kind, 'activity');
  assert.equal(feed[1]?.kind, 'attendedRun');
  assert.equal(feed[2]?.kind, 'dailylog');
  if (feed[0]?.kind === 'activity') {
    assert.equal(feed[0].headline, 'Easy miles before work');
  }
});
