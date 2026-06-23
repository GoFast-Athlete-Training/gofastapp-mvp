-- CreateTable
CREATE TABLE "athlete_health_records" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'garmin',
    "healthType" TEXT NOT NULL,
    "sourceSummaryId" TEXT,
    "calendarDate" TIMESTAMP(3),
    "summaryData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_health_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_health_records_source_healthType_sourceSummaryId_key" ON "athlete_health_records"("source", "healthType", "sourceSummaryId");

-- CreateIndex
CREATE INDEX "athlete_health_records_athleteId_healthType_calendarDate_idx" ON "athlete_health_records"("athleteId", "healthType", "calendarDate");

-- AddForeignKey
ALTER TABLE "athlete_health_records" ADD CONSTRAINT "athlete_health_records_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing Athlete JSON blobs into health records (one row per athlete per type)
INSERT INTO "athlete_health_records" (
    "id",
    "athleteId",
    "source",
    "healthType",
    "sourceSummaryId",
    "calendarDate",
    "summaryData",
    "createdAt",
    "updatedAt"
)
SELECT
    'backfill-daily-' || a."id",
    a."id",
    'garmin',
    'daily',
    COALESCE(a."garmin_user_daily"->>'summaryId', 'legacy-daily-' || a."id"),
    CASE
        WHEN a."garmin_user_daily"->>'calendarDate' ~ '^\d{4}-\d{2}-\d{2}$'
        THEN (a."garmin_user_daily"->>'calendarDate')::timestamp
        ELSE NULL
    END,
    a."garmin_user_daily",
    NOW(),
    NOW()
FROM "Athlete" a
WHERE a."garmin_user_daily" IS NOT NULL
ON CONFLICT ("source", "healthType", "sourceSummaryId") DO NOTHING;

INSERT INTO "athlete_health_records" (
    "id",
    "athleteId",
    "source",
    "healthType",
    "sourceSummaryId",
    "calendarDate",
    "summaryData",
    "createdAt",
    "updatedAt"
)
SELECT
    'backfill-sleep-' || a."id",
    a."id",
    'garmin',
    'sleep',
    COALESCE(a."garmin_user_sleep"->>'summaryId', 'legacy-sleep-' || a."id"),
    CASE
        WHEN a."garmin_user_sleep"->>'calendarDate' ~ '^\d{4}-\d{2}-\d{2}$'
        THEN (a."garmin_user_sleep"->>'calendarDate')::timestamp
        ELSE NULL
    END,
    a."garmin_user_sleep",
    NOW(),
    NOW()
FROM "Athlete" a
WHERE a."garmin_user_sleep" IS NOT NULL
ON CONFLICT ("source", "healthType", "sourceSummaryId") DO NOTHING;

-- Clear bulky legacy columns (data now in athlete_health_records)
UPDATE "Athlete" SET "garmin_user_daily" = NULL WHERE "garmin_user_daily" IS NOT NULL;
UPDATE "Athlete" SET "garmin_user_sleep" = NULL WHERE "garmin_user_sleep" IS NOT NULL;
