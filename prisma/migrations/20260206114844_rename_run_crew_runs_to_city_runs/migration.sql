-- Rename run_crew_runs table to city_runs
-- Rename run_crew_run_rsvps table to city_run_rsvps
-- This removes backwards compatibility naming - everything is now CityRun (universal run system)

BEGIN;

-- Rename main table
ALTER TABLE "run_crew_runs" RENAME TO "city_runs";

-- Rename RSVP table
ALTER TABLE "run_crew_run_rsvps" RENAME TO "city_run_rsvps";

-- Note: PostgreSQL automatically renames:
-- - Indexes (e.g., "run_crew_runs_citySlug_idx" → "city_runs_citySlug_idx")
-- - Foreign key constraints (e.g., "run_crew_runs_runClubId_fkey" → "city_runs_runClubId_fkey")
-- - Primary key constraints
-- - Unique constraints
-- - Check constraints

-- Verify the rename worked
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'city_runs'
  ) THEN
    RAISE EXCEPTION 'Table city_runs does not exist after rename';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'city_run_rsvps'
  ) THEN
    RAISE EXCEPTION 'Table city_run_rsvps does not exist after rename';
  END IF;
END $$;

COMMIT;
