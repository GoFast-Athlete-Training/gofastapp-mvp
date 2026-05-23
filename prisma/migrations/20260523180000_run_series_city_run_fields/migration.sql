-- Add city-run-aligned recurring fields to run_series
ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "totalMiles" DOUBLE PRECISION;
ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "routeNeighborhood" TEXT;
ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "workoutDescription" TEXT;
ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "postRunActivity" TEXT;
