-- Create RunCrew tables (without foreign keys if athletes table doesn't exist)
-- Foreign keys will be added in a follow-up migration once athletes table exists

-- CreateTable
CREATE TABLE IF NOT EXISTS "run_crews" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "joinCode" TEXT NOT NULL,
    "logo" TEXT,
    "icon" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_crews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "run_crew_memberships" (
    "id" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_crew_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "run_crew_managers" (
    "id" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_crew_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "run_crew_messages" (
    "id" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_crew_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "run_crew_announcements" (
    "id" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_crew_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "run_crew_runs" (
    "id" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "runType" TEXT NOT NULL DEFAULT 'single',
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "timezone" TEXT,
    "meetUpPoint" TEXT NOT NULL,
    "meetUpAddress" TEXT,
    "meetUpPlaceId" TEXT,
    "meetUpLat" DOUBLE PRECISION,
    "meetUpLng" DOUBLE PRECISION,
    "recurrenceRule" TEXT,
    "recurrenceEndsOn" TIMESTAMP(3),
    "recurrenceNote" TEXT,
    "totalMiles" DOUBLE PRECISION,
    "pace" TEXT,
    "stravaMapUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_crew_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "run_crew_run_rsvps" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_crew_run_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "run_crew_events" (
    "id" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "eventType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_crew_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "run_crew_event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_crew_event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "join_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "join_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'run_crews') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS "run_crews_joinCode_key" ON "run_crews"("joinCode");
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'run_crew_memberships') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS "run_crew_memberships_runCrewId_athleteId_key" ON "run_crew_memberships"("runCrewId", "athleteId");
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'run_crew_managers') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS "run_crew_managers_runCrewId_athleteId_key" ON "run_crew_managers"("runCrewId", "athleteId");
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'run_crew_run_rsvps') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS "run_crew_run_rsvps_runId_athleteId_key" ON "run_crew_run_rsvps"("runId", "athleteId");
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'run_crew_event_rsvps') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS "run_crew_event_rsvps_eventId_athleteId_key" ON "run_crew_event_rsvps"("eventId", "athleteId");
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'join_codes') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS "join_codes_code_key" ON "join_codes"("code");
    END IF;
END $$;

-- AddForeignKeys (only if athletes table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'athletes') THEN
        -- Add foreign keys only if athletes table exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_memberships_runCrewId_fkey') THEN
            ALTER TABLE "run_crew_memberships" ADD CONSTRAINT "run_crew_memberships_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_memberships_athleteId_fkey') THEN
            ALTER TABLE "run_crew_memberships" ADD CONSTRAINT "run_crew_memberships_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_managers_runCrewId_fkey') THEN
            ALTER TABLE "run_crew_managers" ADD CONSTRAINT "run_crew_managers_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_managers_athleteId_fkey') THEN
            ALTER TABLE "run_crew_managers" ADD CONSTRAINT "run_crew_managers_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_messages_runCrewId_fkey') THEN
            ALTER TABLE "run_crew_messages" ADD CONSTRAINT "run_crew_messages_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_messages_athleteId_fkey') THEN
            ALTER TABLE "run_crew_messages" ADD CONSTRAINT "run_crew_messages_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_announcements_runCrewId_fkey') THEN
            ALTER TABLE "run_crew_announcements" ADD CONSTRAINT "run_crew_announcements_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_announcements_authorId_fkey') THEN
            ALTER TABLE "run_crew_announcements" ADD CONSTRAINT "run_crew_announcements_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_runs_runCrewId_fkey') THEN
            ALTER TABLE "run_crew_runs" ADD CONSTRAINT "run_crew_runs_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_runs_createdById_fkey') THEN
            ALTER TABLE "run_crew_runs" ADD CONSTRAINT "run_crew_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_run_rsvps_runId_fkey') THEN
            ALTER TABLE "run_crew_run_rsvps" ADD CONSTRAINT "run_crew_run_rsvps_runId_fkey" FOREIGN KEY ("runId") REFERENCES "run_crew_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_run_rsvps_athleteId_fkey') THEN
            ALTER TABLE "run_crew_run_rsvps" ADD CONSTRAINT "run_crew_run_rsvps_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_events_runCrewId_fkey') THEN
            ALTER TABLE "run_crew_events" ADD CONSTRAINT "run_crew_events_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_events_organizerId_fkey') THEN
            ALTER TABLE "run_crew_events" ADD CONSTRAINT "run_crew_events_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_event_rsvps_eventId_fkey') THEN
            ALTER TABLE "run_crew_event_rsvps" ADD CONSTRAINT "run_crew_event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "run_crew_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'run_crew_event_rsvps_athleteId_fkey') THEN
            ALTER TABLE "run_crew_event_rsvps" ADD CONSTRAINT "run_crew_event_rsvps_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'join_codes_runCrewId_fkey') THEN
            ALTER TABLE "join_codes" ADD CONSTRAINT "join_codes_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
