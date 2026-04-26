-- AlterTable
ALTER TABLE "athlete_activities" ADD COLUMN "averagePower" INTEGER;

-- AlterTable
ALTER TABLE "bike_workout" ADD COLUMN "matchedActivityId" TEXT,
ADD COLUMN "actualDurationSeconds" INTEGER,
ADD COLUMN "actualDistanceMeters" DOUBLE PRECISION,
ADD COLUMN "actualAvgPowerWatts" INTEGER,
ADD COLUMN "actualAverageHeartRate" INTEGER,
ADD COLUMN "actualMaxHeartRate" INTEGER,
ADD COLUMN "actualElevationGain" DOUBLE PRECISION,
ADD COLUMN "actualCalories" INTEGER,
ADD COLUMN "powerDeltaWatts" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "bike_workout_matchedActivityId_key" ON "bike_workout"("matchedActivityId");

-- AddForeignKey
ALTER TABLE "bike_workout" ADD CONSTRAINT "bike_workout_matchedActivityId_fkey" FOREIGN KEY ("matchedActivityId") REFERENCES "athlete_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
