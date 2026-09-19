-- Structured lap intervals from Garmin FIT activity files (separate from detailData JSON).
ALTER TABLE "athlete_activities" ADD COLUMN "fitLapData" JSONB;
