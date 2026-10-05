-- Shakeout canon: meetup place stays on city_runs; drop Company dedupe string and run_locations catalogue.

UPDATE "city_runs"
SET "cityRunType" = 'RACE_SHAKEOUT'
WHERE "shakeoutDedupeKey" IS NOT NULL;

UPDATE "city_runs"
SET "cityRunType" = 'RACE_SHAKEOUT'
WHERE "raceRegistryId" IS NOT NULL
  AND "cityRunType" = 'OTHER';

ALTER TABLE "city_runs" DROP CONSTRAINT IF EXISTS "city_runs_locationId_fkey";
DROP INDEX IF EXISTS "city_runs_locationId_idx";
ALTER TABLE "city_runs" DROP COLUMN IF EXISTS "locationId";

DROP INDEX IF EXISTS "city_runs_shakeoutDedupeKey_key";
ALTER TABLE "city_runs" DROP COLUMN IF EXISTS "shakeoutDedupeKey";

DROP TABLE IF EXISTS "run_locations";
