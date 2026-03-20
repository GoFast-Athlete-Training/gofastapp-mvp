-- AlterTable
ALTER TABLE "training_plans" ADD COLUMN     "phases" JSONB,
ADD COLUMN     "planWeeks" JSONB,
ADD COLUMN     "current5KPace" TEXT,
ADD COLUMN     "preferredDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN     "planId" TEXT,
ADD COLUMN     "date" TIMESTAMP(3),
ADD COLUMN     "phase" TEXT,
ADD COLUMN     "estimatedDistanceInMeters" DOUBLE PRECISION,
ADD COLUMN     "matchedActivityId" TEXT,
ADD COLUMN     "actualDistanceMeters" DOUBLE PRECISION,
ADD COLUMN     "actualAvgPaceSecPerMile" INTEGER,
ADD COLUMN     "actualAverageHeartRate" INTEGER,
ADD COLUMN     "actualDurationSeconds" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "workouts_matchedActivityId_key" ON "workouts"("matchedActivityId");

-- CreateIndex
CREATE INDEX "workouts_planId_idx" ON "workouts"("planId");

-- CreateIndex
CREATE INDEX "workouts_planId_date_idx" ON "workouts"("planId", "date");

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_planId_fkey" FOREIGN KEY ("planId") REFERENCES "training_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_matchedActivityId_fkey" FOREIGN KEY ("matchedActivityId") REFERENCES "athlete_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
