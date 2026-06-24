-- CreateEnum
CREATE TYPE "AthletePersonaCapability" AS ENUM ('NON_RUNNER', 'BEGINNER', 'RECREATIONAL', 'COMPETITIVE', 'ELITE');

-- CreateEnum
CREATE TYPE "AthletePersonaDedication" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'ELITE');

-- AlterTable
ALTER TABLE "training_plan_preset" ADD COLUMN     "coachIntent" TEXT,
ADD COLUMN     "objectiveOfPlan" TEXT,
ADD COLUMN     "athletePersonaCapability" "AthletePersonaCapability",
ADD COLUMN     "athletePersonaGoal" TEXT,
ADD COLUMN     "athletePersonaDedication" "AthletePersonaDedication",
ADD COLUMN     "coachPlanOverview" JSONB,
ADD COLUMN     "paceProfile" JSONB;
