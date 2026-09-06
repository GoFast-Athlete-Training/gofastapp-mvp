-- Athlete login snap: goal race pace (sec/mi) copied from primary athlete_races row.

ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "goalRacePace" INTEGER;

UPDATE "Athlete" AS a
SET
  "goalRacePace" = ar."goalRacePace",
  "updatedAt" = NOW()
FROM "athlete_races" AS ar
WHERE ar."athleteId" = a."id"
  AND ar."isPrimaryRace" = true
  AND ar."goalRacePace" IS NOT NULL
  AND a."goalRacePace" IS NULL;
