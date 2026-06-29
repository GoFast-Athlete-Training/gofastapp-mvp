-- CreateEnum
CREATE TYPE "TrainingPlanGoalType" AS ENUM ('RACE', 'GENERAL_FITNESS', 'MORE_ENDURANCE');

-- AlterTable training_plan_persona
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "runningHistory" TEXT;
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "runningHistorySummary" TEXT;
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "currentCapability" TEXT;
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "currentCapabilitySummary" TEXT;
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "injuryAssessment" TEXT;
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "injuryAssessmentSummary" TEXT;
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "dedicationText" TEXT;
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "dedicationSummary" TEXT;
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "abilityToTrain" TEXT;
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "abilityToTrainSummary" TEXT;
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "estimated5kTimeSeconds" INTEGER;
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "estimated5kPerformanceSummary" TEXT;
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "estimated5kPerformanceRationale" TEXT;
ALTER TABLE "training_plan_persona" ADD COLUMN IF NOT EXISTS "athletePersonaSummary" TEXT;

-- AlterTable training_plan_goal
ALTER TABLE "training_plan_goal" ADD COLUMN IF NOT EXISTS "goalType" "TrainingPlanGoalType";

-- AlterTable training_plan_preset
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "workoutStructure" JSONB;
