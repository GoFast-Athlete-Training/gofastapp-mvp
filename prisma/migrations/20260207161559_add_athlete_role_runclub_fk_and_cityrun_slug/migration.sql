-- Add AthleteRole enum
CREATE TYPE "AthleteRole" AS ENUM ('USER', 'CLUB_LEADER', 'AMBASSADOR');

-- Add role and runClubId to Athlete
ALTER TABLE "Athlete" ADD COLUMN "role" "AthleteRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "Athlete" ADD COLUMN "runClubId" TEXT;

-- Add FK constraint for Athlete.runClubId → run_clubs.id
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_runClubId_fkey" 
  FOREIGN KEY ("runClubId") REFERENCES "run_clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for runClubId
CREATE INDEX IF NOT EXISTS "Athlete_runClubId_idx" ON "Athlete"("runClubId");

-- Add slug to city_runs
ALTER TABLE "city_runs" ADD COLUMN "slug" TEXT;

-- Create unique index for slug (allows nulls but ensures uniqueness for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS "city_runs_slug_key" ON "city_runs"("slug") WHERE "slug" IS NOT NULL;

-- Add index for slug lookups
CREATE INDEX IF NOT EXISTS "city_runs_slug_idx" ON "city_runs"("slug");

-- Note: Slug backfill will be done separately via script
-- Existing CityRuns will have NULL slug until backfilled
