-- Drop city_run_event_rsvps first (FK dependency on city_run_events)
DROP TABLE IF EXISTS "city_run_event_rsvps";

-- Drop city_run_events (FK dependency on city_runs)
DROP TABLE IF EXISTS "city_run_events";

-- Add occurrenceDate to city_run_rsvps
-- null = standalone run; set = recurring (the specific occurrence date this RSVP is for)
ALTER TABLE "city_run_rsvps" ADD COLUMN IF NOT EXISTS "occurrenceDate" TIMESTAMP(3);

-- Index for querying RSVPs by occurrence date
CREATE INDEX IF NOT EXISTS "city_run_rsvps_occurrenceDate_idx" ON "city_run_rsvps"("occurrenceDate");
