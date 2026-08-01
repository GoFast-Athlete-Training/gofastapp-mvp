import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyFollowerPreviewMode,
  athleteCommunityRelationship,
} from './athlete-community-access';

test('anonymous public read without participation', () => {
  assert.deepEqual(
    athleteCommunityRelationship({
      hostAthleteId: 'host-1',
      callerAthleteId: null,
      hasMembership: false,
    }),
    {
      isOwner: false,
      isFollowing: false,
      canParticipate: false,
    }
  );
});

test('owner moderation without treating owner as follower', () => {
  assert.deepEqual(
    athleteCommunityRelationship({
      hostAthleteId: 'host-1',
      callerAthleteId: 'host-1',
      hasMembership: false,
    }),
    {
      isOwner: true,
      isFollowing: false,
      canParticipate: true,
    }
  );
});

test('follower participation without plan enrollment semantics', () => {
  assert.deepEqual(
    athleteCommunityRelationship({
      hostAthleteId: 'host-1',
      callerAthleteId: 'follower-1',
      hasMembership: true,
    }),
    {
      isOwner: false,
      isFollowing: true,
      canParticipate: true,
    }
  );
});

test('signed-in non-followers remain read-only', () => {
  assert.deepEqual(
    athleteCommunityRelationship({
      hostAthleteId: 'host-1',
      callerAthleteId: 'viewer-1',
      hasMembership: false,
    }),
    {
      isOwner: false,
      isFollowing: false,
      canParticipate: false,
    }
  );
});

test('preview mode suppresses owner affordances without fake follower permissions', () => {
  assert.deepEqual(
    applyFollowerPreviewMode(
      { isOwner: true, isFollowing: false, canParticipate: true },
      true
    ),
    {
      displayAsOwner: false,
      displayAsFollower: false,
      canParticipate: false,
    }
  );
});

test('preview mode leaves normal owner state unchanged outside preview', () => {
  assert.deepEqual(
    applyFollowerPreviewMode(
      { isOwner: true, isFollowing: false, canParticipate: true },
      false
    ),
    {
      displayAsOwner: true,
      displayAsFollower: false,
      canParticipate: true,
    }
  );
});
