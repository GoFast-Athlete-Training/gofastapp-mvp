-- Add run detail fields to city_runs
-- These fields were added to the schema but migration was missing

ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunActivity" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "routeNeighborhood" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "runType" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "workoutDescription" TEXT;
