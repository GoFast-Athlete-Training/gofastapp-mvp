-- Run club container: memberships, announcements, events, event RSVPs

CREATE TABLE "run_club_memberships" (
    "id" TEXT NOT NULL,
    "runClubId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_club_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "run_club_memberships_runClubId_athleteId_key" ON "run_club_memberships"("runClubId", "athleteId");
CREATE INDEX "run_club_memberships_runClubId_idx" ON "run_club_memberships"("runClubId");
CREATE INDEX "run_club_memberships_athleteId_idx" ON "run_club_memberships"("athleteId");

ALTER TABLE "run_club_memberships" ADD CONSTRAINT "run_club_memberships_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "run_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_club_memberships" ADD CONSTRAINT "run_club_memberships_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "run_club_announcements" (
    "id" TEXT NOT NULL,
    "runClubId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'members',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_club_announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "run_club_announcements_runClubId_publishedAt_idx" ON "run_club_announcements"("runClubId", "publishedAt");

ALTER TABLE "run_club_announcements" ADD CONSTRAINT "run_club_announcements_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "run_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_club_announcements" ADD CONSTRAINT "run_club_announcements_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "run_club_events" (
    "id" TEXT NOT NULL,
    "runClubId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'social',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_club_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "run_club_events_runClubId_startsAt_idx" ON "run_club_events"("runClubId", "startsAt");

ALTER TABLE "run_club_events" ADD CONSTRAINT "run_club_events_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "run_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_club_events" ADD CONSTRAINT "run_club_events_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "run_club_event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'going',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_club_event_rsvps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "run_club_event_rsvps_eventId_athleteId_key" ON "run_club_event_rsvps"("eventId", "athleteId");
CREATE INDEX "run_club_event_rsvps_athleteId_idx" ON "run_club_event_rsvps"("athleteId");

ALTER TABLE "run_club_event_rsvps" ADD CONSTRAINT "run_club_event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "run_club_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_club_event_rsvps" ADD CONSTRAINT "run_club_event_rsvps_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
