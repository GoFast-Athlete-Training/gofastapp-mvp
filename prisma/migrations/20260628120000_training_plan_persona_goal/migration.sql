-- CreateEnum
CREATE TYPE "FitnessDelta" AS ENUM ('SMALL', 'MODERATE', 'LARGE');

-- CreateEnum
CREATE TYPE "ProgressionAggressiveness" AS ENUM ('CONSERVATIVE', 'MODERATE', 'AMBITIOUS');

-- CreateEnum
CREATE TYPE "TrainingPlanGoalKind" AS ENUM ('RACE', 'TRAINING_BLOCK');

-- CreateTable
CREATE TABLE "training_plan_persona" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "capability" "AthletePersonaCapability",
    "dedication" "AthletePersonaDedication",
    "personaGoalLabel" TEXT,
    "workoutFrequencyCap" INTEGER,
    "intentSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plan_persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_goal" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "targetDistanceLabel" TEXT,
    "objectiveOfPlan" TEXT,
    "planDurationWeeks" INTEGER NOT NULL,
    "timeHorizonLabel" TEXT,
    "fitnessDelta" "FitnessDelta",
    "progressionAggressiveness" "ProgressionAggressiveness",
    "intensityReasoning" TEXT,
    "goalKind" "TrainingPlanGoalKind",
    "coachIntent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plan_goal_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "training_plan_preset" ADD COLUMN "personaId" TEXT;
ALTER TABLE "training_plan_preset" ADD COLUMN "goalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "training_plan_persona_slug_key" ON "training_plan_persona"("slug");
CREATE INDEX "training_plan_persona_capability_idx" ON "training_plan_persona"("capability");

CREATE UNIQUE INDEX "training_plan_goal_slug_key" ON "training_plan_goal"("slug");
CREATE INDEX "training_plan_goal_personaId_idx" ON "training_plan_goal"("personaId");
CREATE INDEX "training_plan_goal_planDurationWeeks_idx" ON "training_plan_goal"("planDurationWeeks");

CREATE INDEX "training_plan_preset_personaId_idx" ON "training_plan_preset"("personaId");
CREATE INDEX "training_plan_preset_goalId_idx" ON "training_plan_preset"("goalId");

-- AddForeignKey
ALTER TABLE "training_plan_goal" ADD CONSTRAINT "training_plan_goal_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "training_plan_persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "training_plan_persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "training_plan_goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
