-- Drop deprecated training_plan_days table
DROP TABLE IF EXISTS "training_plan_days" CASCADE;

-- CreateEnum for WorkoutType (only if it doesn't exist)
DO $$ BEGIN
  CREATE TYPE "WorkoutType" AS ENUM ('Easy', 'Tempo', 'Intervals', 'LongRun', 'Speed', 'Strength');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum for WorkoutFormat (only if it doesn't exist)
DO $$ BEGIN
  CREATE TYPE "WorkoutFormat" AS ENUM ('Continuous', 'WarmupMainCooldown', 'Progression', 'IntervalsUnstructured');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum for EffortType (only if it doesn't exist)
DO $$ BEGIN
  CREATE TYPE "EffortType" AS ENUM ('Easy', 'MarathonEffort', 'HalfMarathonEffort', 'TenKEffort', 'FiveKEffort', 'RPE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: Workout (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS "workouts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "workoutType" "WorkoutType" NOT NULL,
    "description" TEXT,
    "workoutFormat" "WorkoutFormat",
    "totalMiles" DOUBLE PRECISION,
    "warmUpMiles" DOUBLE PRECISION,
    "mainSetMiles" DOUBLE PRECISION,
    "coolDownMiles" DOUBLE PRECISION,
    "effortType" "EffortType",
    "effortModifier" DOUBLE PRECISION,
    "athleteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if it doesn't exist)
CREATE INDEX IF NOT EXISTS "workouts_athleteId_idx" ON "workouts"("athleteId");

-- CreateIndex (only if it doesn't exist)
CREATE INDEX IF NOT EXISTS "workouts_workoutType_idx" ON "workouts"("workoutType");

-- AddForeignKey (only if it doesn't exist)
DO $$ BEGIN
  ALTER TABLE "workouts" ADD CONSTRAINT "workouts_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
