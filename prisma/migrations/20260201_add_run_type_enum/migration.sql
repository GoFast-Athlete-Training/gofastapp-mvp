-- Migration: Replace isRecurring boolean with RunType enum
-- Date: 2026-02-01
-- Purpose: Better distinction between single events, recurring templates, and instances

-- Step 1: Create enum type
CREATE TYPE "RunType" AS ENUM ('SINGLE_EVENT', 'RECURRING', 'INSTANCE', 'APPROVED');

-- Step 2: Add new columns
ALTER TABLE "run_crew_runs" ADD COLUMN "runType" "RunType" DEFAULT 'SINGLE_EVENT';
ALTER TABLE "run_crew_runs" ADD COLUMN "recurringParentId" TEXT;

-- Step 3: Migrate existing data
-- isRecurring: true -> RECURRING
UPDATE "run_crew_runs" SET "runType" = 'RECURRING' WHERE "isRecurring" = true;

-- isRecurring: false -> SINGLE_EVENT (already default, but explicit)
UPDATE "run_crew_runs" SET "runType" = 'SINGLE_EVENT' WHERE "isRecurring" = false;

-- Step 4: Add foreign key constraint for recurringParentId
ALTER TABLE "run_crew_runs" ADD CONSTRAINT "run_crew_runs_recurringParentId_fkey" 
FOREIGN KEY ("recurringParentId") REFERENCES "run_crew_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS "run_crew_runs_runType_idx" ON "run_crew_runs"("runType");
CREATE INDEX IF NOT EXISTS "run_crew_runs_recurringParentId_idx" ON "run_crew_runs"("recurringParentId");

-- Step 6: Make runType NOT NULL (after data migration)
ALTER TABLE "run_crew_runs" ALTER COLUMN "runType" SET NOT NULL;

-- Step 7: Remove old boolean column (keep for now, remove in next migration after verification)
-- ALTER TABLE "run_crew_runs" DROP COLUMN "isRecurring";
-- DROP INDEX IF EXISTS "run_crew_runs_isRecurring_idx";
