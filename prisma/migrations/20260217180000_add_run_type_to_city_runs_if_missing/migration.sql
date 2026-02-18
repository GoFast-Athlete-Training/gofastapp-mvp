-- Safe migration: add runType and recurringParentId to city_runs when missing.
-- Use when the table is already city_runs but runType was never added
-- (e.g. run_type migration targeted run_crew_runs and was skipped or applied in different order).

-- 1. Create RunType enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RunType') THEN
    CREATE TYPE "RunType" AS ENUM ('SINGLE_EVENT', 'RECURRING', 'INSTANCE', 'APPROVED');
  END IF;
END $$;

-- 2. Add runType column to city_runs if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'city_runs' AND column_name = 'runType'
  ) THEN
    ALTER TABLE "city_runs" ADD COLUMN "runType" "RunType" DEFAULT 'SINGLE_EVENT';
    UPDATE "city_runs" SET "runType" = 'RECURRING' WHERE "isRecurring" = true;
    UPDATE "city_runs" SET "runType" = 'SINGLE_EVENT' WHERE "runType" IS NULL;
    ALTER TABLE "city_runs" ALTER COLUMN "runType" SET NOT NULL;
    CREATE INDEX IF NOT EXISTS "city_runs_runType_idx" ON "city_runs"("runType");
  END IF;
END $$;

-- 3. Add recurringParentId column and FK/index if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'city_runs' AND column_name = 'recurringParentId'
  ) THEN
    ALTER TABLE "city_runs" ADD COLUMN "recurringParentId" TEXT;
    ALTER TABLE "city_runs" ADD CONSTRAINT "city_runs_recurringParentId_fkey"
      FOREIGN KEY ("recurringParentId") REFERENCES "city_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    CREATE INDEX IF NOT EXISTS "city_runs_recurringParentId_idx" ON "city_runs"("recurringParentId");
  END IF;
END $$;
