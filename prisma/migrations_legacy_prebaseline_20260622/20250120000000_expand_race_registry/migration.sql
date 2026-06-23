-- Migration: Expand race_registry to unified race model
-- Adds all new fields for comprehensive race data
-- Backward compatible - existing fields preserved

-- Step 1: Copy data from old fields to new fields
UPDATE "race_registry"
SET 
  "raceDate" = "date",
  "distanceMiles" = "miles"
WHERE "raceDate" IS NULL OR "distanceMiles" IS NULL;

-- Add new fields
ALTER TABLE "race_registry"
  ADD COLUMN IF NOT EXISTS "slug" TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "distanceKm" FLOAT,
  ADD COLUMN IF NOT EXISTS "startTime" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "endTime" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "timezone" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationOpenDate" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "registrationCloseDate" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "startLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "finishLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "startLat" FLOAT,
  ADD COLUMN IF NOT EXISTS "startLng" FLOAT,
  ADD COLUMN IF NOT EXISTS "finishLat" FLOAT,
  ADD COLUMN IF NOT EXISTS "finishLng" FLOAT,
  ADD COLUMN IF NOT EXISTS "registrationUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "officialWebsiteUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "resultsUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "courseMapUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "stravaSegmentUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "elevationGain" FLOAT,
  ADD COLUMN IF NOT EXISTS "elevationGainMeters" FLOAT,
  ADD COLUMN IF NOT EXISTS "surfaceType" TEXT,
  ADD COLUMN IF NOT EXISTS "courseType" TEXT,
  ADD COLUMN IF NOT EXISTS "courseProfile" JSONB,
  ADD COLUMN IF NOT EXISTS "typicalWeather" TEXT,
  ADD COLUMN IF NOT EXISTS "averageTemperature" INT,
  ADD COLUMN IF NOT EXISTS "averageHumidity" INT,
  ADD COLUMN IF NOT EXISTS "charitySupported" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "charityName" TEXT,
  ADD COLUMN IF NOT EXISTS "charityUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "charityDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "organizerName" TEXT,
  ADD COLUMN IF NOT EXISTS "organizerEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "organizerWebsite" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationFee" FLOAT,
  ADD COLUMN IF NOT EXISTS "earlyBirdFee" FLOAT,
  ADD COLUMN IF NOT EXISTS "earlyBirdDeadline" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "maxParticipants" INT,
  ADD COLUMN IF NOT EXISTS "currentParticipants" INT,
  ADD COLUMN IF NOT EXISTS "ageMinimum" INT,
  ADD COLUMN IF NOT EXISTS "ageMaximum" INT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "isVirtual" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isCancelled" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Generate slugs from name + date for existing races
UPDATE "race_registry"
SET "slug" = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      name || '-' || TO_CHAR("raceDate", 'YYYY'),
      '[^a-z0-9]+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  )
)
WHERE "slug" IS NULL;

-- Calculate distanceKm from distanceMiles
UPDATE "race_registry"
SET "distanceKm" = "distanceMiles" * 1.60934
WHERE "distanceKm" IS NULL AND "distanceMiles" IS NOT NULL;

-- Set isActive = true for all existing races
UPDATE "race_registry"
SET "isActive" = true
WHERE "isActive" IS NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS "race_registry_raceDate_idx" ON "race_registry"("raceDate");
CREATE INDEX IF NOT EXISTS "race_registry_city_state_idx" ON "race_registry"("city", "state");
CREATE INDEX IF NOT EXISTS "race_registry_raceType_idx" ON "race_registry"("raceType");
CREATE INDEX IF NOT EXISTS "race_registry_slug_idx" ON "race_registry"("slug");
CREATE INDEX IF NOT EXISTS "race_registry_isActive_idx" ON "race_registry"("isActive");
CREATE INDEX IF NOT EXISTS "race_registry_charitySupported_idx" ON "race_registry"("charitySupported");
CREATE INDEX IF NOT EXISTS "race_registry_tags_idx" ON "race_registry" USING GIN("tags");

