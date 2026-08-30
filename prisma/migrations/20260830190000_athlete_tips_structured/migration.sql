-- Structured Tips: takeaway + optional tip series JSON on athlete_tips
ALTER TABLE "athlete_tips" ADD COLUMN IF NOT EXISTS "takeaway" TEXT;
ALTER TABLE "athlete_tips" ADD COLUMN IF NOT EXISTS "tipSeries" JSONB;
