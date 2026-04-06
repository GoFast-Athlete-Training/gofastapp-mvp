-- CreateTable
CREATE TABLE "pace_adjustment_log" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "planId" TEXT,
    "weekNumber" INTEGER,
    "previousPaceSecPerMile" INTEGER NOT NULL,
    "newPaceSecPerMile" INTEGER NOT NULL,
    "adjustmentSecPerMile" INTEGER NOT NULL,
    "qualityWorkoutsCount" INTEGER NOT NULL DEFAULT 0,
    "qualityAvgDeltaSecPerMile" INTEGER,
    "longRunCompleted" BOOLEAN NOT NULL DEFAULT false,
    "longRunCompletionRatio" DOUBLE PRECISION,
    "weeklyMileageCompletionPct" DOUBLE PRECISION,
    "summaryMessage" TEXT,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pace_adjustment_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pace_adjustment_log_athleteId_seenAt_idx" ON "pace_adjustment_log"("athleteId", "seenAt");

-- CreateIndex
CREATE INDEX "pace_adjustment_log_planId_weekNumber_idx" ON "pace_adjustment_log"("planId", "weekNumber");

-- AddForeignKey
ALTER TABLE "pace_adjustment_log" ADD CONSTRAINT "pace_adjustment_log_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pace_adjustment_log" ADD CONSTRAINT "pace_adjustment_log_planId_fkey" FOREIGN KEY ("planId") REFERENCES "training_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "workouts" DROP COLUMN IF EXISTS "phase";
ALTER TABLE "workouts" DROP COLUMN IF EXISTS "adaptiveFiveKCreditAppliedAt";
