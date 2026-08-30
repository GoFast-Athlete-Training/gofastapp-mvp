-- Lap-level pace deltas (analyzer writes) + Athlete goal race login snap strings.

ALTER TABLE "workout_segment_laps" ADD COLUMN IF NOT EXISTS "prescribedPaceMinSecPerMile" INTEGER;
ALTER TABLE "workout_segment_laps" ADD COLUMN IF NOT EXISTS "prescribedPaceMaxSecPerMile" INTEGER;
ALTER TABLE "workout_segment_laps" ADD COLUMN IF NOT EXISTS "paceDeltaSecPerMile" INTEGER;

ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "goalRaceName" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "goalRaceTime" TEXT;

-- Backfill goal snap from current primary race rows.
UPDATE "Athlete" AS a
SET
  "goalRaceName" = ar."name",
  "goalRaceTime" = ar."goalTime",
  "updatedAt" = NOW()
FROM "athlete_races" AS ar
WHERE ar."athleteId" = a."id"
  AND ar."isPrimaryRace" = true;
