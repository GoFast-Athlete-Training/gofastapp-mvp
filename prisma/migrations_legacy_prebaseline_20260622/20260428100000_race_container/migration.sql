-- Race container: memberships, chatter, announcements, events, city_runs → race_registry

CREATE TYPE "RaceMemberRole" AS ENUM ('MEMBER', 'ADMIN');

CREATE TABLE "race_memberships" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "role" "RaceMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "race_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "race_memberships_raceId_athleteId_key" ON "race_memberships"("raceId", "athleteId");
CREATE INDEX "race_memberships_raceId_idx" ON "race_memberships"("raceId");
CREATE INDEX "race_memberships_athleteId_idx" ON "race_memberships"("athleteId");

ALTER TABLE "race_memberships" ADD CONSTRAINT "race_memberships_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "race_memberships" ADD CONSTRAINT "race_memberships_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "race_messages" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "race_messages_raceId_idx" ON "race_messages"("raceId");
CREATE INDEX "race_messages_athleteId_idx" ON "race_messages"("athleteId");

ALTER TABLE "race_messages" ADD CONSTRAINT "race_messages_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "race_messages" ADD CONSTRAINT "race_messages_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "race_announcements" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "race_announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "race_announcements_raceId_idx" ON "race_announcements"("raceId");

ALTER TABLE "race_announcements" ADD CONSTRAINT "race_announcements_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "race_announcements" ADD CONSTRAINT "race_announcements_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "race_events" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "additionalDetails" TEXT,
    "cost" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "race_events_raceId_idx" ON "race_events"("raceId");
CREATE INDEX "race_events_date_idx" ON "race_events"("date");

ALTER TABLE "race_events" ADD CONSTRAINT "race_events_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "race_events" ADD CONSTRAINT "race_events_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "race_event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "race_event_rsvps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "race_event_rsvps_eventId_athleteId_key" ON "race_event_rsvps"("eventId", "athleteId");

ALTER TABLE "race_event_rsvps" ADD CONSTRAINT "race_event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "race_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "race_event_rsvps" ADD CONSTRAINT "race_event_rsvps_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "city_runs" ADD COLUMN "raceRegistryId" TEXT;
CREATE INDEX "city_runs_raceRegistryId_idx" ON "city_runs"("raceRegistryId");
ALTER TABLE "city_runs" ADD CONSTRAINT "city_runs_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "race_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
