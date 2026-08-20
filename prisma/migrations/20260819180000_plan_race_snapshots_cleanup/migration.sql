-- Rename canonical plan → athlete race FK
ALTER TABLE "training_plans" RENAME COLUMN "primaryAthleteRaceId" TO "athleteRaceId";

ALTER INDEX "training_plans_primaryAthleteRaceId_idx" RENAME TO "training_plans_athleteRaceId_idx";

ALTER TABLE "training_plans" RENAME CONSTRAINT "training_plans_primaryAthleteRaceId_fkey" TO "training_plans_athleteRaceId_fkey";

-- Plan-level race snapshots (frozen at create / reassignment / generation)
ALTER TABLE "training_plans" ADD COLUMN "athleteRaceMainSnap" JSONB;
ALTER TABLE "training_plans" ADD COLUMN "athleteRaceAlongWaySnaps" JSONB;

-- Drop dead training_plan_race_events persistence
DROP TABLE IF EXISTS "training_plan_race_events";

DROP TYPE IF EXISTS "TrainingPlanRaceEventRole";
DROP TYPE IF EXISTS "TrainingPlanRaceEventSource";
DROP TYPE IF EXISTS "TrainingPlanRaceEventInclusion";
