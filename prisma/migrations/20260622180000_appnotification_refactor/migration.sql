-- App notification refactor: device tokens + template-driven deliveries

CREATE TABLE "athlete_appnotification_devices" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "platform" TEXT,
    "deviceId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_appnotification_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "appnotification_deliveries" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "deeplink" TEXT,
    "payload" JSONB,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appnotification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "athlete_appnotification_devices_expoPushToken_key" ON "athlete_appnotification_devices"("expoPushToken");
CREATE INDEX "athlete_appnotification_devices_athleteId_idx" ON "athlete_appnotification_devices"("athleteId");

CREATE UNIQUE INDEX "appnotification_deliveries_dedupeKey_key" ON "appnotification_deliveries"("dedupeKey");
CREATE INDEX "appnotification_deliveries_athleteId_readAt_idx" ON "appnotification_deliveries"("athleteId", "readAt");
CREATE INDEX "appnotification_deliveries_templateKey_objectType_objectId_idx" ON "appnotification_deliveries"("templateKey", "objectType", "objectId");

ALTER TABLE "athlete_appnotification_devices" ADD CONSTRAINT "athlete_appnotification_devices_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appnotification_deliveries" ADD CONSTRAINT "appnotification_deliveries_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill device tokens
INSERT INTO "athlete_appnotification_devices" (
    "id", "athleteId", "expoPushToken", "platform", "deviceId", "enabled", "lastSeenAt", "createdAt", "updatedAt"
)
SELECT
    "id", "athleteId", "expoPushToken", "platform", "deviceId", "enabled", "lastSeenAt", "createdAt", "updatedAt"
FROM "athlete_push_tokens";

-- Backfill deliveries from legacy notifications (best-effort template/object inference)
INSERT INTO "appnotification_deliveries" (
    "id", "athleteId", "templateKey", "objectType", "objectId", "dedupeKey", "deeplink", "payload", "sentAt", "readAt", "createdAt", "updatedAt"
)
SELECT
    n."id",
    n."athleteId",
    CASE
        WHEN n."type" = 'workout_complete' THEN 'workout.complete'
        WHEN n."type" = 'crew_announcement' THEN 'crew.announcement'
        WHEN n."type" = 'club_run_today' THEN 'clubRun.today'
        WHEN n."type" = 'club_run_tomorrow' THEN 'clubRun.tomorrow'
        WHEN n."type" = 'run_reminder' AND (n."payload"->>'scheduledRunId') IS NOT NULL THEN 'scheduledRun.tomorrow'
        WHEN n."type" = 'run_reminder' THEN 'workout.tomorrow'
        ELSE 'workout.tomorrow'
    END,
    CASE
        WHEN n."type" = 'workout_complete' THEN 'workout'
        WHEN n."type" = 'crew_announcement' THEN 'run_crew_announcement'
        WHEN n."type" IN ('club_run_today', 'club_run_tomorrow') THEN 'city_run'
        WHEN n."type" = 'run_reminder' AND (n."payload"->>'scheduledRunId') IS NOT NULL THEN 'scheduled_run'
        WHEN n."type" = 'run_reminder' THEN 'workout'
        ELSE 'workout'
    END,
    COALESCE(
        n."payload"->>'workoutId',
        n."payload"->>'scheduledRunId',
        n."payload"->>'runId',
        n."payload"->>'announcementId',
        n."id"
    ),
    n."dedupeKey",
    n."deeplink",
    n."payload",
    n."sentAt",
    n."readAt",
    n."createdAt",
    n."updatedAt"
FROM "athlete_notifications" n;

DROP TABLE "athlete_notifications";
DROP TABLE "athlete_push_tokens";
