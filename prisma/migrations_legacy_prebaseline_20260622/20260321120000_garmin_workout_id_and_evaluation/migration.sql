-- AlterTable
ALTER TABLE "athlete_activities" ADD COLUMN "ingestionStatus" TEXT NOT NULL DEFAULT 'RECEIVED';

-- CreateIndex
CREATE INDEX "athlete_activities_athleteId_ingestionStatus_idx" ON "athlete_activities"("athleteId", "ingestionStatus");

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN "garminWorkoutId" INTEGER,
ADD COLUMN "actualMaxHeartRate" INTEGER,
ADD COLUMN "actualElevationGain" DOUBLE PRECISION,
ADD COLUMN "actualCalories" INTEGER,
ADD COLUMN "actualSteps" INTEGER,
ADD COLUMN "derivedPerformanceDeltaSeconds" INTEGER,
ADD COLUMN "derivedPerformanceDirection" TEXT,
ADD COLUMN "derivedAgainstTargetPace" INTEGER,
ADD COLUMN "evaluationEligibleFlag" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "workouts_athleteId_garminWorkoutId_idx" ON "workouts"("athleteId", "garminWorkoutId");
