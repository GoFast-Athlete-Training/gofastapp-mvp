-- Goal lives on athlete_races; drop Athlete profile snapshot columns.

ALTER TABLE "athlete_races" ADD COLUMN "goalName" TEXT;
ALTER TABLE "athlete_races" ADD COLUMN "goalDescription" TEXT;
ALTER TABLE "athlete_races" ADD COLUMN "goalDistance" TEXT;
ALTER TABLE "athlete_races" ADD COLUMN "goalTime" TEXT;
ALTER TABLE "athlete_races" ADD COLUMN "goalRacePace" INTEGER;
ALTER TABLE "athlete_races" ADD COLUMN "goalPace5K" INTEGER;
ALTER TABLE "athlete_races" ADD COLUMN "whyGoal" TEXT;
ALTER TABLE "athlete_races" ADD COLUMN "successLooksLike" TEXT;
ALTER TABLE "athlete_races" ADD COLUMN "completionFeeling" TEXT;
ALTER TABLE "athlete_races" ADD COLUMN "motivationIcon" TEXT;

-- Backfill from active goals linked to athlete races.
UPDATE "athlete_races" AS ar
SET
  "goalName" = g."name",
  "goalDescription" = g."description",
  "goalDistance" = g."distance",
  "goalTime" = g."goalTime",
  "goalRacePace" = g."goalRacePace",
  "goalPace5K" = g."goalPace5K",
  "whyGoal" = g."whyGoal",
  "successLooksLike" = g."successLooksLike",
  "completionFeeling" = g."completionFeeling",
  "motivationIcon" = g."motivationIcon",
  "updatedAt" = NOW()
FROM "athlete_goals" AS g
WHERE g."athleteRaceId" = ar."id"
  AND g."status" = 'ACTIVE';

-- Drop athlete profile snapshot columns (goal/race cache).
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryGoalNameSnapshot";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryGoalTimeSnapshot";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryGoalTargetByDateSnapshot";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryGoalRaceNameSnapshot";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryRaceRegistryIdSnapshot";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryRaceSlugSnapshot";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryRaceNameSnapshot";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryRaceDateSnapshot";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryRaceDistanceLabelSnapshot";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryRaceCitySnapshot";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "primaryRaceStateSnapshot";
