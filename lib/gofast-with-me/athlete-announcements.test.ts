import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('schema defines first-class gofast_athlete_announcements', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  assert.match(schema, /model gofast_athlete_announcements/);
  assert.match(schema, /hostAthleteId\s+String/);
  assert.match(schema, /@@map\("gofast_athlete_announcements"\)/);
});

test('messages route rejects topic=updates in favor of announcements API', () => {
  const route = readFileSync(
    join(process.cwd(), 'app/api/athlete/[id]/container/messages/route.ts'),
    'utf8'
  );
  assert.match(route, /rawTopic === 'updates'/);
  assert.match(route, /announcements/);
});

test('announcements API routes exist', () => {
  const createRoute = readFileSync(
    join(process.cwd(), 'app/api/athlete/[id]/announcements/route.ts'),
    'utf8'
  );
  const deleteRoute = readFileSync(
    join(process.cwd(), 'app/api/athlete/[id]/announcements/[announcementId]/route.ts'),
    'utf8'
  );
  assert.match(createRoute, /createAthleteAnnouncement/);
  assert.match(deleteRoute, /deleteAthleteAnnouncement/);
});
