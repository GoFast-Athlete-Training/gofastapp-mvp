-- AlterTable
ALTER TABLE "training_plans" ADD COLUMN IF NOT EXISTS "weeklyMileageTarget" INTEGER;

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "nOffset" INTEGER;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "weekNumber" INTEGER;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "dayAssigned" TEXT;

-- AlterTable
ALTER TABLE "workout_segments" ADD COLUMN IF NOT EXISTS "actualPaceSecPerMile" INTEGER;
ALTER TABLE "workout_segments" ADD COLUMN IF NOT EXISTS "actualDistanceMiles" DOUBLE PRECISION;
ALTER TABLE "workout_segments" ADD COLUMN IF NOT EXISTS "actualDurationSeconds" INTEGER;

CREATE INDEX IF NOT EXISTS "workouts_planId_weekNumber_idx" ON "workouts"("planId", "weekNumber");
CREATE INDEX IF NOT EXISTS "workouts_planId_nOffset_idx" ON "workouts"("planId", "nOffset");
