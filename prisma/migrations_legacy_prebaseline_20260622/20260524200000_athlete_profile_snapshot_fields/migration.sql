-- Correct athlete profile cache: explicit Snapshot columns, no pseudo-relationship ids.

ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryGoalNameSnapshot" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryGoalTimeSnapshot" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryGoalTargetByDateSnapshot" TIMESTAMP(3);
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryGoalRaceNameSnapshot" TEXT;

ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryRaceRegistryIdSnapshot" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryRaceSlugSnapshot" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryRaceNameSnapshot" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryRaceDateSnapshot" TIMESTAMP(3);
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryRaceDistanceLabelSnapshot" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryRaceCitySnapshot" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "primaryRaceStateSnapshot" TEXT;

-- Backfill race snapshots from wrongly named columns.
UPDATE "Athlete"
SET
  "primaryRaceRegistryIdSnapshot" = "primaryRaceRegistryId",
  "primaryRaceNameSnapshot" = "primaryRaceName",
  "primaryRaceDateSnapshot" = "primaryRaceDate",
  "primaryRaceDistanceLabelSnapshot" = "primaryRaceDistanceLabel",
  "primaryRaceCitySnapshot" = "primaryRaceCity",
  "primaryRaceStateSnapshot" = "primaryRaceState"
WHERE "primaryRaceRegistryId" IS NOT NULL;

-- Backfill goal snapshots from linked AthleteGoal when primaryGoalId was set.
UPDATE "Athlete" AS a
SET
  "primaryGoalNameSnapshot" = g.name,
  "primaryGoalTimeSnapshot" = g."goalTime",
  "primaryGoalTargetByDateSnapshot" = g."targetByDate",
  "primaryGoalRaceNameSnapshot" = r.name
FROM "athlete_goals" AS g
LEFT JOIN "race_registry" AS r ON r.id = g."raceRegistryId"
WHERE a."primaryGoalId" IS NOT NULL
  AND g.id = a."primaryGoalId";

-- Drop wrongly named pseudo-relationship columns.
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryGoalId";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryRaceRegistryId";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryRaceName";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryRaceDate";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryRaceDistanceLabel";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryRaceCity";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryRaceState";
