import assert from 'node:assert/strict';
import test from 'node:test';
import {
  athleteCommunityPath,
  athleteCommunityPreviewPath,
  athletePublicPagePath,
  legacyContainerRedirectTarget,
  mapLegacyContainerHash,
} from './athlete-community-routes';

test('builds canonical community URLs', () => {
  assert.equal(athletePublicPagePath('Adam'), '/u/adam');
  assert.equal(athleteCommunityPath('adam'), '/u/adam/community');
  assert.equal(athleteCommunityPath('adam', 'plan'), '/u/adam/community#plan');
  assert.equal(athleteCommunityPreviewPath('adam'), '/u/adam/community?preview=follower');
});

test('maps legacy hashes to community sections', () => {
  assert.equal(mapLegacyContainerHash('#plan-strip'), 'plan');
  assert.equal(mapLegacyContainerHash('messages'), 'updates');
  assert.equal(mapLegacyContainerHash('feed'), 'chatter');
  assert.equal(mapLegacyContainerHash('runs'), 'goruns');
});

test('redirects legacy container paths', () => {
  assert.equal(legacyContainerRedirectTarget('adam', '#plan-strip'), '/u/adam/community#plan');
  assert.equal(legacyContainerRedirectTarget('adam', '#feed'), '/u/adam/community#chatter');
  assert.equal(legacyContainerRedirectTarget('adam'), '/u/adam/community');
});
