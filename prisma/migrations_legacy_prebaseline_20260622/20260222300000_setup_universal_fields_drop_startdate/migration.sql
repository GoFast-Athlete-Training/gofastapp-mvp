-- Drop startDate and endDate from city_runs (occurrence date is just `date`)
-- Drop city_run_events if still present in DB (dropped from schema earlier)
-- Add universal inference fields to city_run_setups

-- 1. Drop city_run_events (was removed from schema; may still exist in DB)
DROP TABLE IF EXISTS "city_run_event_rsvps";
DROP TABLE IF EXISTS "city_run_events";

-- 2. Drop startDate and endDate from city_runs
ALTER TABLE "city_runs" DROP COLUMN IF EXISTS "startDate";
ALTER TABLE "city_runs" DROP COLUMN IF EXISTS "endDate";

-- 3. Drop old startDate index (replaced by existing date index)
DROP INDEX IF EXISTS "city_runs_startDate_idx";

-- 4. Add universal fields to city_run_setups
ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "description"         TEXT;
ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "gofastCity"          TEXT;
ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "meetUpPoint"         TEXT;
ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "meetUpStreetAddress" TEXT;
ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "meetUpCity"          TEXT;
ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "meetUpState"         TEXT;
ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "meetUpPlaceId"       TEXT;
ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "meetUpLat"           DOUBLE PRECISION;
ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "meetUpLng"           DOUBLE PRECISION;
ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "startTimeHour"       INTEGER;
ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "startTimeMinute"     INTEGER;
ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "startTimePeriod"     TEXT;

-- 5. Add indexes on city_run_setups
CREATE INDEX IF NOT EXISTS "city_run_setups_gofastCity_idx" ON "city_run_setups"("gofastCity");
CREATE INDEX IF NOT EXISTS "city_run_setups_dayOfWeek_idx"  ON "city_run_setups"("dayOfWeek");
