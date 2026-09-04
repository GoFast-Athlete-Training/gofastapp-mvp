-- Drop Garmin echo id indexes
DROP INDEX IF EXISTS "planned_workouts_athleteId_garminWorkoutId_idx";
DROP INDEX IF EXISTS "workouts_athleteId_garminWorkoutId_idx";

-- Stack-owned push stamp on planned plan days
ALTER TABLE "planned_workouts" ADD COLUMN "workoutPushed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "planned_workouts" ADD COLUMN "workoutEditedAfterPush" BOOLEAN NOT NULL DEFAULT false;

-- Treat prior Garmin pushes as stamped so cron does not double-send
UPDATE "planned_workouts"
SET "workoutPushed" = true
WHERE "garminWorkoutId" IS NOT NULL OR "garminScheduleId" IS NOT NULL;

ALTER TABLE "planned_workouts" DROP COLUMN "garminWorkoutId";
ALTER TABLE "planned_workouts" DROP COLUMN "garminScheduleId";

ALTER TABLE "workouts" DROP COLUMN IF EXISTS "garminWorkoutId";
ALTER TABLE "workouts" DROP COLUMN IF EXISTS "garminScheduleId";

ALTER TABLE "bike_workout" DROP COLUMN IF EXISTS "garminWorkoutId";
ALTER TABLE "bike_workout" DROP COLUMN IF EXISTS "garminScheduleId";

ALTER TABLE "swim_workout" DROP COLUMN IF EXISTS "garminWorkoutId";
ALTER TABLE "swim_workout" DROP COLUMN IF EXISTS "garminScheduleId";
