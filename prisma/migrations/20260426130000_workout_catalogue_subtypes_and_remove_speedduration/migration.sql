-- Staff-defined sub-type (primary lookup for services); slug is optional kebab normalisation
ALTER TABLE "workout_catalogue" ADD COLUMN "runSubType" TEXT;
ALTER TABLE "workout_catalogue" ADD COLUMN "workSegmentsJson" JSONB;
ALTER TABLE "workout_catalogue" ADD COLUMN "warmupFraction" DOUBLE PRECISION;
ALTER TABLE "workout_catalogue" ADD COLUMN "workFraction" DOUBLE PRECISION;
ALTER TABLE "workout_catalogue" ADD COLUMN "cooldownFraction" DOUBLE PRECISION;

-- Consolidate SpeedDuration into Tempo
UPDATE "workout_catalogue" SET "workoutType" = 'Tempo' WHERE "workoutType" = 'SpeedDuration';
UPDATE "workouts" SET "workoutType" = 'Tempo' WHERE "workoutType" = 'SpeedDuration';

-- Drop SpeedDuration from WorkoutType enum
ALTER TYPE "WorkoutType" RENAME TO "WorkoutType_old";
CREATE TYPE "WorkoutType" AS ENUM ('Easy', 'Tempo', 'Intervals', 'LongRun', 'Race');
ALTER TABLE "workout_catalogue" ALTER COLUMN "workoutType" TYPE "WorkoutType" USING ("workoutType"::text::"WorkoutType");
ALTER TABLE "workouts" ALTER COLUMN "workoutType" TYPE "WorkoutType" USING ("workoutType"::text::"WorkoutType");
DROP TYPE "WorkoutType_old";
