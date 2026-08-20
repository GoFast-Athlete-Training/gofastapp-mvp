-- Snapshot slug/logo on athlete_races for athlete-scoped public display
ALTER TABLE "athlete_races" ADD COLUMN "slug" TEXT;
ALTER TABLE "athlete_races" ADD COLUMN "logoUrl" TEXT;

UPDATE "athlete_races" AS ar
SET
  "slug" = rr."slug",
  "logoUrl" = rr."logoUrl"
FROM "race_registry" AS rr
WHERE ar."raceRegistryId" = rr."id";

-- Backfill athleteRaceId on goals that only had raceRegistryId
UPDATE "athlete_goals" AS ag
SET "athleteRaceId" = ar."id"
FROM "athlete_races" AS ar
WHERE ag."athleteRaceId" IS NULL
  AND ag."raceRegistryId" IS NOT NULL
  AND ar."athleteId" = ag."athleteId"
  AND ar."raceRegistryId" = ag."raceRegistryId";

-- Retire competing goal race identity
ALTER TABLE "athlete_goals" DROP CONSTRAINT IF EXISTS "athlete_goals_raceRegistryId_fkey";
DROP INDEX IF EXISTS "athlete_goals_raceRegistryId_idx";
ALTER TABLE "athlete_goals" DROP COLUMN IF EXISTS "raceRegistryId";
