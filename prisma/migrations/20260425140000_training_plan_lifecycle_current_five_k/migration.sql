-- CreateEnum
CREATE TYPE "TrainingPlanLifecycle" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "training_plans" ADD COLUMN "lifecycleStatus" "TrainingPlanLifecycle" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "training_plans" ADD COLUMN "currentFiveKPace" TEXT;

-- CreateIndex
CREATE INDEX "training_plans_athleteId_lifecycleStatus_idx" ON "training_plans"("athleteId", "lifecycleStatus");

-- Backfill pace snapshot from athlete profile
UPDATE "training_plans" AS tp
SET "currentFiveKPace" = a."fiveKPace"
FROM "Athlete" AS a
WHERE tp."athleteId" = a."id"
  AND tp."currentFiveKPace" IS NULL
  AND a."fiveKPace" IS NOT NULL
  AND trim(a."fiveKPace") <> '';

-- MVP1: keep a single ACTIVE plan per athlete (latest by updatedAt); archive the rest
WITH keeper AS (
  SELECT DISTINCT ON ("athleteId") id
  FROM "training_plans"
  ORDER BY "athleteId", "updatedAt" DESC
)
UPDATE "training_plans" AS tp
SET "lifecycleStatus" = 'ARCHIVED'
WHERE NOT EXISTS (SELECT 1 FROM keeper k WHERE k.id = tp.id);
