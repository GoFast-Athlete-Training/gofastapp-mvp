-- Rename city_run_setups → run_series
-- Rename cityRunSetupId → runSeriesId on city_runs
-- Update all indexes accordingly

-- 1. Rename the table
ALTER TABLE "city_run_setups" RENAME TO "run_series";

-- 2. Rename FK column on city_runs
ALTER TABLE "city_runs" RENAME COLUMN "cityRunSetupId" TO "runSeriesId";

-- 3. Rename indexes on run_series (previously city_run_setups)
ALTER INDEX IF EXISTS "city_run_setups_runClubId_idx"   RENAME TO "run_series_runClubId_idx";
ALTER INDEX IF EXISTS "city_run_setups_gofastCity_idx"  RENAME TO "run_series_gofastCity_idx";
ALTER INDEX IF EXISTS "city_run_setups_dayOfWeek_idx"   RENAME TO "run_series_dayOfWeek_idx";

-- 4. Rename FK index on city_runs
ALTER INDEX IF EXISTS "city_runs_cityRunSetupId_idx"    RENAME TO "city_runs_runSeriesId_idx";

-- 5. Rename FK constraint if named
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'city_runs_cityRunSetupId_fkey'
  ) THEN
    ALTER TABLE "city_runs"
      RENAME CONSTRAINT "city_runs_cityRunSetupId_fkey" TO "city_runs_runSeriesId_fkey";
  END IF;
END $$;
