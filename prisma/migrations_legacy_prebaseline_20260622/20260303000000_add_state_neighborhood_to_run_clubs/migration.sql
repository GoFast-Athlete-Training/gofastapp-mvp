-- Add state and neighborhood fields to run_clubs
ALTER TABLE "run_clubs" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "run_clubs" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
