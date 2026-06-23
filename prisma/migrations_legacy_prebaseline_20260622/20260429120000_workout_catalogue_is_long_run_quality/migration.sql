-- AlterTable
ALTER TABLE "workout_catalogue" ADD COLUMN "isLongRunQuality" BOOLEAN NOT NULL DEFAULT false;

-- Backfill canonical seed names (safe no-op if rows absent)
UPDATE "workout_catalogue"
SET "isLongRunQuality" = true
WHERE "workoutType" = 'LongRun'
  AND name IN ('Long Run Quality', 'Marathon Test');
