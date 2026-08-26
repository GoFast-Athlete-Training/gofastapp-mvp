-- Rename long-run pool columns (not weekly mileage)
ALTER TABLE "training_plan_preset" RENAME COLUMN "baseMiles" TO "baseLongRunPoolMiles";
ALTER TABLE "training_plan_preset" RENAME COLUMN "peakMiles" TO "peakLongRunPoolMiles";
ALTER TABLE "training_plan_preset" RENAME COLUMN "taperMiles" TO "taperLongRunPoolMiles";

ALTER TABLE "athlete_presets" RENAME COLUMN "baseMiles" TO "baseLongRunPoolMiles";
ALTER TABLE "athlete_presets" RENAME COLUMN "peakMiles" TO "peakLongRunPoolMiles";
ALTER TABLE "athlete_presets" RENAME COLUMN "taperMiles" TO "taperLongRunPoolMiles";

ALTER TABLE "athlete_presets" ADD COLUMN IF NOT EXISTS "longestSaturdayMiles" DOUBLE PRECISION;
ALTER TABLE "athlete_presets" ADD COLUMN IF NOT EXISTS "peakLongRunDate" TIMESTAMP(3);
ALTER TABLE "athlete_presets" ADD COLUMN IF NOT EXISTS "taperStartDate" TIMESTAMP(3);
ALTER TABLE "athlete_presets" ADD COLUMN IF NOT EXISTS "trainingStartDate" TIMESTAMP(3);
ALTER TABLE "athlete_presets" ADD COLUMN IF NOT EXISTS "raceDateSnapshot" TIMESTAMP(3);
