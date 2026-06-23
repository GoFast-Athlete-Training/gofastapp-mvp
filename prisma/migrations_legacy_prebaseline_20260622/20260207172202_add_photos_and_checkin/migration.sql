-- Add photo fields to city_runs
ALTER TABLE "city_runs" ADD COLUMN "routePhotos" JSONB;
ALTER TABLE "city_runs" ADD COLUMN "mapImageUrl" TEXT;

-- Add check-in timestamp to city_run_rsvps (no boolean - just timestamp)
ALTER TABLE "city_run_rsvps" ADD COLUMN "checkedInAt" TIMESTAMP(3);

-- Add index for checkedInAt lookups
CREATE INDEX IF NOT EXISTS "city_run_rsvps_checkedInAt_idx" ON "city_run_rsvps"("checkedInAt");

-- Note: routePhotos is JSONB array of photo URLs
-- Example: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"]
-- Note: checkedInAt is null if not checked in, has timestamp if checked in
