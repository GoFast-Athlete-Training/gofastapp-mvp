-- Add staffNotes to city_runs for data entry notes (e.g. "Couldn't get Strava URL")
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "staffNotes" TEXT;
