-- Athlete-level primary goal + primary race snap for profile hydration.
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryGoalId" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryRaceRegistryId" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryRaceName" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryRaceDate" TIMESTAMP(3);
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryRaceDistanceLabel" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryRaceCity" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryRaceState" TEXT;
