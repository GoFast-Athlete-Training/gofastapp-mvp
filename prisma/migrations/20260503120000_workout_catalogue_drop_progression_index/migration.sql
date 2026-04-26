-- Catalogue ordering hint removed; list queries use (workoutType, name) via Prisma
DROP INDEX IF EXISTS "workout_catalogue_workoutType_progressionIndex_idx";
ALTER TABLE "workout_catalogue" DROP COLUMN IF EXISTS "progressionIndex";
CREATE INDEX IF NOT EXISTS "workout_catalogue_workoutType_idx" ON "workout_catalogue"("workoutType");
