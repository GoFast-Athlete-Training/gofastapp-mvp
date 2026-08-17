import assert from 'node:assert/strict';
import test from 'node:test';
import { composeCommunityFeed } from './community-feed';

test('composeCommunityFeed merges and sorts reverse-chronologically', () => {
  const feed = composeCommunityFeed({
    updateMessages: [
      {
        id: 'm1',
        body: 'Week 3 check-in',
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
    tips: [
      {
        id: 't1',
        title: 'Easy miles',
        body: 'Keep it conversational',
        mediaUrl: null,
        mediaType: null,
        sortOrder: 0,
        visibility: 'published',
        publishedAt: '2026-08-15T10:00:00.000Z',
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-15T10:00:00.000Z',
      },
    ],
    upcomingRuns: [
      {
        id: 'r1',
        title: 'Saturday long run',
        date: '2026-08-20T08:00:00.000Z',
        meetUpPoint: 'Memorial',
        gorunPath: '/gorun/r1',
      },
    ],
  });

  assert.equal(feed.length, 3);
  assert.equal(feed[0]?.kind, 'run');
  assert.equal(feed[1]?.kind, 'tip');
  assert.equal(feed[2]?.kind, 'dailylog');
});

test('composeCommunityFeed includes latest training activity', () => {
  const feed = composeCommunityFeed({
    updateMessages: [],
    tips: [],
    upcomingRuns: [],
    lastActivity: {
      activityName: 'Morning Run',
      startTime: '2026-08-16T07:00:00.000Z',
      distanceMiles: 6.2,
      durationSeconds: 3180,
      activityType: 'Run',
      source: 'strava',
    },
  });

  assert.equal(feed.length, 1);
  assert.equal(feed[0]?.kind, 'training');
  if (feed[0]?.kind === 'training') {
    assert.equal(feed[0].activity.activityName, 'Morning Run');
  }
});
