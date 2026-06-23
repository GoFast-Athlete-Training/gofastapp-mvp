-- Add end point fields to run_series table
ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "endPoint" TEXT;
ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "endStreetAddress" TEXT;
ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "endCity" TEXT;
ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "endState" TEXT;
