-- Drop legacy standalone-catalog columns from race_registry.
-- Company sync + athlete app never read or write these fields.

DROP INDEX IF EXISTS "race_registry_charitySupported_idx";

ALTER TABLE "race_registry"
  DROP COLUMN IF EXISTS "address",
  DROP COLUMN IF EXISTS "ageMaximum",
  DROP COLUMN IF EXISTS "ageMinimum",
  DROP COLUMN IF EXISTS "averageHumidity",
  DROP COLUMN IF EXISTS "averageTemperature",
  DROP COLUMN IF EXISTS "cancellationReason",
  DROP COLUMN IF EXISTS "charityDescription",
  DROP COLUMN IF EXISTS "charitySupported",
  DROP COLUMN IF EXISTS "courseProfile",
  DROP COLUMN IF EXISTS "courseType",
  DROP COLUMN IF EXISTS "currentParticipants",
  DROP COLUMN IF EXISTS "earlyBirdDeadline",
  DROP COLUMN IF EXISTS "earlyBirdFee",
  DROP COLUMN IF EXISTS "elevationGain",
  DROP COLUMN IF EXISTS "elevationGainMeters",
  DROP COLUMN IF EXISTS "endTime",
  DROP COLUMN IF EXISTS "finishLat",
  DROP COLUMN IF EXISTS "finishLng",
  DROP COLUMN IF EXISTS "finishLocation",
  DROP COLUMN IF EXISTS "maxParticipants",
  DROP COLUMN IF EXISTS "notes",
  DROP COLUMN IF EXISTS "organizerEmail",
  DROP COLUMN IF EXISTS "organizerName",
  DROP COLUMN IF EXISTS "organizerWebsite",
  DROP COLUMN IF EXISTS "startLat",
  DROP COLUMN IF EXISTS "startLng",
  DROP COLUMN IF EXISTS "startLocation",
  DROP COLUMN IF EXISTS "stravaSegmentUrl",
  DROP COLUMN IF EXISTS "surfaceType",
  DROP COLUMN IF EXISTS "timezone",
  DROP COLUMN IF EXISTS "typicalWeather";
