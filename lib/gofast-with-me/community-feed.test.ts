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
    activityPosts: [],
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

test('composeCommunityFeed includes published activity posts only via input', () => {
  const feed = composeCommunityFeed({
    updateMessages: [],
    tips: [],
    upcomingRuns: [],
    activityPosts: [
      {
        id: 'p1',
        activityId: 'a1',
        caption: 'Felt strong today',
        photoUrl: 'https://example.com/photo.jpg',
        showMatchedWorkout: true,
        publishedAt: '2026-08-16T08:00:00.000Z',
        activity: {
          activityName: 'Morning Run',
          startTime: '2026-08-16T07:00:00.000Z',
          distanceMiles: 6.2,
          durationSeconds: 3180,
          activityType: 'Run',
        },
        matchedWorkout: {
          title: 'Easy 6',
          workoutType: 'EasyRun',
          planName: 'Marathon Block',
        },
      },
    ],
  });

  assert.equal(feed.length, 1);
  assert.equal(feed[0]?.kind, 'activity');
  if (feed[0]?.kind === 'activity') {
    assert.equal(feed[0].post.caption, 'Felt strong today');
    assert.equal(feed[0].post.matchedWorkout?.title, 'Easy 6');
  }
});
