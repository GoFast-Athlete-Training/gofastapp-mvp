-- Split CityRun into series + event instances.
-- Keep city_runs as the parent series model.
-- Introduce city_run_events as RSVP-bearing instances.

CREATE TABLE IF NOT EXISTS "city_run_events" (
  "id" TEXT NOT NULL,
  "cityRunId" TEXT NOT NULL,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT,
  "meetUpPoint" TEXT NOT NULL,
  "meetUpPlaceId" TEXT,
  "meetUpLat" DOUBLE PRECISION,
  "meetUpLng" DOUBLE PRECISION,
  "totalMiles" DOUBLE PRECISION,
  "pace" TEXT,
  "stravaMapUrl" TEXT,
  "description" TEXT,
  "postRunActivity" TEXT,
  "routePhotos" JSONB,
  "mapImageUrl" TEXT,
  "staffNotes" TEXT,
  "stravaUrl" TEXT,
  "stravaText" TEXT,
  "webUrl" TEXT,
  "webText" TEXT,
  "igPostText" TEXT,
  "igPostGraphic" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "startTimeHour" INTEGER,
  "startTimeMinute" INTEGER,
  "startTimePeriod" TEXT,
  "slug" TEXT,
  "workflowStatus" "RunWorkflowStatus" NOT NULL DEFAULT 'DEVELOP',
  "endPoint" TEXT,
  "meetUpStreetAddress" TEXT,
  "meetUpCity" TEXT,
  "meetUpState" TEXT,
  "meetUpZip" TEXT,
  "routeNeighborhood" TEXT,
  "runType" TEXT,
  "workoutDescription" TEXT,
  "endStreetAddress" TEXT,
  "endCity" TEXT,
  "endState" TEXT,
  "generationSource" TEXT DEFAULT 'MANUAL',
  "isCancelled" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "city_run_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "city_run_events_cityRunId_fkey" FOREIGN KEY ("cityRunId") REFERENCES "city_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "city_run_events_slug_key" ON "city_run_events"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "city_run_events_cityRunId_eventDate_key" ON "city_run_events"("cityRunId", "eventDate");
CREATE INDEX IF NOT EXISTS "city_run_events_cityRunId_idx" ON "city_run_events"("cityRunId");
CREATE INDEX IF NOT EXISTS "city_run_events_eventDate_idx" ON "city_run_events"("eventDate");
CREATE INDEX IF NOT EXISTS "city_run_events_workflowStatus_idx" ON "city_run_events"("workflowStatus");

CREATE TABLE IF NOT EXISTS "city_run_event_rsvps" (
  "id" TEXT NOT NULL,
  "cityRunEventId" TEXT NOT NULL,
  "athleteId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "checkedInAt" TIMESTAMP(3),
  "rsvpPhotoUrls" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "city_run_event_rsvps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "city_run_event_rsvps_cityRunEventId_fkey" FOREIGN KEY ("cityRunEventId") REFERENCES "city_run_events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "city_run_event_rsvps_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "city_run_event_rsvps_cityRunEventId_athleteId_key" ON "city_run_event_rsvps"("cityRunEventId", "athleteId");
CREATE INDEX IF NOT EXISTS "city_run_event_rsvps_cityRunEventId_idx" ON "city_run_event_rsvps"("cityRunEventId");
CREATE INDEX IF NOT EXISTS "city_run_event_rsvps_checkedInAt_idx" ON "city_run_event_rsvps"("checkedInAt");

-- Backfill one initial event per existing city_run record.
INSERT INTO "city_run_events" (
  "id",
  "cityRunId",
  "eventDate",
  "timezone",
  "meetUpPoint",
  "meetUpPlaceId",
  "meetUpLat",
  "meetUpLng",
  "totalMiles",
  "pace",
  "stravaMapUrl",
  "description",
  "postRunActivity",
  "routePhotos",
  "mapImageUrl",
  "staffNotes",
  "stravaUrl",
  "stravaText",
  "webUrl",
  "webText",
  "igPostText",
  "igPostGraphic",
  "createdAt",
  "updatedAt",
  "startTimeHour",
  "startTimeMinute",
  "startTimePeriod",
  "slug",
  "workflowStatus",
  "endPoint",
  "meetUpStreetAddress",
  "meetUpCity",
  "meetUpState",
  "meetUpZip",
  "routeNeighborhood",
  "runType",
  "workoutDescription",
  "endStreetAddress",
  "endCity",
  "endState",
  "generationSource",
  "isCancelled"
)
SELECT
  "id",
  "id",
  "startDate",
  "timezone",
  "meetUpPoint",
  "meetUpPlaceId",
  "meetUpLat",
  "meetUpLng",
  "totalMiles",
  "pace",
  "stravaMapUrl",
  "description",
  "postRunActivity",
  "routePhotos",
  "mapImageUrl",
  "staffNotes",
  "stravaUrl",
  "stravaText",
  "webUrl",
  "webText",
  "igPostText",
  "igPostGraphic",
  "createdAt",
  "updatedAt",
  "startTimeHour",
  "startTimeMinute",
  "startTimePeriod",
  "slug",
  "workflowStatus",
  "endPoint",
  "meetUpStreetAddress",
  "meetUpCity",
  "meetUpState",
  "meetUpZip",
  "routeNeighborhood",
  "runType",
  "workoutDescription",
  "endStreetAddress",
  "endCity",
  "endState",
  'MIGRATED',
  false
FROM "city_runs"
ON CONFLICT ("id") DO NOTHING;

-- Backfill RSVP rows from city_run_rsvps to city_run_event_rsvps.
-- During initial migration, event id == legacy run id.
INSERT INTO "city_run_event_rsvps" (
  "id",
  "cityRunEventId",
  "athleteId",
  "status",
  "checkedInAt",
  "rsvpPhotoUrls",
  "createdAt"
)
SELECT
  r."id",
  r."runId",
  r."athleteId",
  r."status",
  r."checkedInAt",
  r."rsvpPhotoUrls",
  r."createdAt"
FROM "city_run_rsvps" r
ON CONFLICT ("id") DO NOTHING;
