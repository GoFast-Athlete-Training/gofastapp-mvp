import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('public community loader omits chatter on the payload', () => {
  const src = readFileSync(
    join(repoRoot, 'lib/gofast-with-me/container-hub-service.ts'),
    'utf8'
  );
  assert.match(src, /messages:\s*\[\]/);
});

test('in-app community home uses forward preview, not hub stream feed', () => {
  const viewSrc = readFileSync(
    join(repoRoot, 'components/gofast-with-me/AthleteCommunityView.tsx'),
    'utf8'
  );
  assert.match(viewSrc, /PublicContainerPreview/);
  assert.doesNotMatch(viewSrc, /AthleteHubStreamFeed/);

  const sectionsSrc = readFileSync(
    join(repoRoot, 'components/gofast-with-me/AthleteCommunitySections.tsx'),
    'utf8'
  );
  assert.doesNotMatch(sectionsSrc, /composeHubStreamFeed|AthleteHubStreamFeed/);
});

test('chatter API routes exist for authed community access', () => {
  const chatterRoute = join(
    repoRoot,
    'app/api/athlete/public/[handle]/community/chatter/route.ts'
  );
  const src = readFileSync(chatterRoute, 'utf8');
  assert.match(src, /export async function GET/);
  assert.match(src, /export async function POST/);
});

test('follow route supports unfollow', () => {
  const src = readFileSync(join(repoRoot, 'app/api/follow/[handle]/route.ts'), 'utf8');
  assert.match(src, /export async function DELETE/);
  assert.match(src, /unfollowAthleteBySlug/);
});
