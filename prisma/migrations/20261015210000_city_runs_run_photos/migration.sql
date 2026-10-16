-- Athlete-uploaded photos describing the run (separate from route path photos).
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "runPhotos" JSONB;
