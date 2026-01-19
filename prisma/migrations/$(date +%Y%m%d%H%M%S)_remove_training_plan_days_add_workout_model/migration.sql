-- Drop deprecated training_plan_days table
DROP TABLE IF EXISTS "training_plan_days" CASCADE;

-- CreateEnum for WorkoutType
CREATE TYPE "WorkoutType" AS ENUM ('Easy', 'Tempo', 'Intervals', 'LongRun', 'Speed', 'Strength');

-- CreateEnum for WorkoutFormat
CREATE TYPE "WorkoutFormat" AS ENUM ('Continuous', 'WarmupMainCooldown', 'Progression', 'IntervalsUnstructured');

-- CreateEnum for EffortType
CREATE TYPE "EffortType" AS ENUM ('Easy', 'MarathonEffort', 'HalfMarathonEffort', 'TenKEffort', 'FiveKEffort', 'RPE');

-- CreateTable: Workout
CREATE TABLE "workouts" (
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

-- CreateIndex
CREATE INDEX "workouts_athleteId_idx" ON "workouts"("athleteId");

-- CreateIndex
CREATE INDEX "workouts_workoutType_idx" ON "workouts"("workoutType");

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

