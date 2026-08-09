-- First-class athlete community announcements (Run Club pattern).
-- Journey weekly messages are NOT a topic on gofast_container_messages / chatter.

CREATE TABLE "gofast_athlete_announcements" (
    "id" TEXT NOT NULL,
    "hostAthleteId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gofast_athlete_announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gofast_athlete_announcements_hostAthleteId_publishedAt_idx"
  ON "gofast_athlete_announcements"("hostAthleteId", "publishedAt");

ALTER TABLE "gofast_athlete_announcements"
  ADD CONSTRAINT "gofast_athlete_announcements_hostAthleteId_fkey"
  FOREIGN KEY ("hostAthleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gofast_athlete_announcements"
  ADD CONSTRAINT "gofast_athlete_announcements_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill prior topic=updates posts into the announcements table, then remove them from chatter messages.
INSERT INTO "gofast_athlete_announcements" (
  "id",
  "hostAthleteId",
  "authorId",
  "title",
  "body",
  "publishedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  m."id",
  m."containerAthleteId",
  m."authorAthleteId",
  NULL,
  m."body",
  m."createdAt",
  m."createdAt",
  m."createdAt"
FROM "gofast_container_messages" m
WHERE m."topic" = 'updates'
ON CONFLICT ("id") DO NOTHING;

DELETE FROM "gofast_container_messages" WHERE "topic" = 'updates';
