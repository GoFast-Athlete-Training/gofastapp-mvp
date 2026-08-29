-- Plan-level override for peak long-run pool (sum of 4 peak-block Saturdays).
ALTER TABLE "training_plans" ADD COLUMN IF NOT EXISTS "peakLongRunPoolMiles" DOUBLE PRECISION;
