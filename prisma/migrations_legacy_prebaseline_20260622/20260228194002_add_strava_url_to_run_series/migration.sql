-- Add stravaUrl field to run_series table
ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "stravaUrl" TEXT;
