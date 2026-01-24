-- Add missing address fields to city_runs table (run_crew_runs)
ALTER TABLE "run_crew_runs" 
ADD COLUMN IF NOT EXISTS "meetUpStreetAddress" TEXT,
ADD COLUMN IF NOT EXISTS "meetUpCity" TEXT,
ADD COLUMN IF NOT EXISTS "meetUpState" TEXT,
ADD COLUMN IF NOT EXISTS "meetUpZip" TEXT,
ADD COLUMN IF NOT EXISTS "endStreetAddress" TEXT,
ADD COLUMN IF NOT EXISTS "endCity" TEXT,
ADD COLUMN IF NOT EXISTS "endState" TEXT;

