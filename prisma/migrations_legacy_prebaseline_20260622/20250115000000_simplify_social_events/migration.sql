-- AlterTable: Simplify run_crew_events for social events only
-- Remove eventType field
ALTER TABLE "run_crew_events" DROP COLUMN IF EXISTS "eventType";

-- Rename location to venue
ALTER TABLE "run_crew_events" RENAME COLUMN "location" TO "venue";

-- Add new social-specific fields
ALTER TABLE "run_crew_events" ADD COLUMN IF NOT EXISTS "cost" INTEGER;
ALTER TABLE "run_crew_events" ADD COLUMN IF NOT EXISTS "additionalDetails" TEXT;

-- Add indexes
CREATE INDEX IF NOT EXISTS "run_crew_events_runCrewId_idx" ON "run_crew_events"("runCrewId");
CREATE INDEX IF NOT EXISTS "run_crew_events_date_idx" ON "run_crew_events"("date");

