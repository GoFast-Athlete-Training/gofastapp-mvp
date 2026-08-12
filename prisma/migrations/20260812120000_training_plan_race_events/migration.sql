-- CreateEnum
CREATE TYPE "TrainingPlanRaceEventRole" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "TrainingPlanRaceEventSource" AS ENUM ('GOAL', 'CALENDAR', 'ATHLETE');

-- CreateEnum
CREATE TYPE "TrainingPlanRaceEventInclusion" AS ENUM ('INCLUDED', 'EXCLUDED');

-- CreateTable
CREATE TABLE "training_plan_race_events" (
    "id" TEXT NOT NULL,
    "trainingPlanId" TEXT NOT NULL,
    "raceRegistryId" TEXT NOT NULL,
    "athleteRaceSignupId" TEXT,
    "role" "TrainingPlanRaceEventRole" NOT NULL,
    "source" "TrainingPlanRaceEventSource" NOT NULL DEFAULT 'CALENDAR',
    "inclusion" "TrainingPlanRaceEventInclusion" NOT NULL DEFAULT 'INCLUDED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plan_race_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_plan_race_events_trainingPlanId_idx" ON "training_plan_race_events"("trainingPlanId");

-- CreateIndex
CREATE INDEX "training_plan_race_events_raceRegistryId_idx" ON "training_plan_race_events"("raceRegistryId");

-- CreateIndex
CREATE UNIQUE INDEX "training_plan_race_events_trainingPlanId_raceRegistryId_key" ON "training_plan_race_events"("trainingPlanId", "raceRegistryId");

-- AddForeignKey
ALTER TABLE "training_plan_race_events" ADD CONSTRAINT "training_plan_race_events_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_race_events" ADD CONSTRAINT "training_plan_race_events_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_race_events" ADD CONSTRAINT "training_plan_race_events_athleteRaceSignupId_fkey" FOREIGN KEY ("athleteRaceSignupId") REFERENCES "athlete_race_signups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
