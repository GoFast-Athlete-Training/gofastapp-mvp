-- Remove Speed and Strength from WorkoutType enum (MVP: Easy, Tempo, LongRun, Intervals only).
-- 1) Remap any existing workouts that used Speed or Strength to Easy.
UPDATE "workouts"
SET "workoutType" = 'Easy'
WHERE "workoutType" IN ('Speed', 'Strength');

-- 2) Create new enum without Speed/Strength.
CREATE TYPE "WorkoutType_new" AS ENUM ('Easy', 'Tempo', 'Intervals', 'LongRun');

-- 3) Switch column to new enum.
ALTER TABLE "workouts"
  ALTER COLUMN "workoutType" TYPE "WorkoutType_new"
  USING ("workoutType"::text::"WorkoutType_new");

-- 4) Drop old enum and rename new one.
DROP TYPE "WorkoutType";
ALTER TYPE "WorkoutType_new" RENAME TO "WorkoutType";
