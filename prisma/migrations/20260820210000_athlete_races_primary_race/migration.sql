-- Goal race canon: one explicit primary race per athlete (cheer-me-on / public UX).

ALTER TABLE "athlete_races" ADD COLUMN "isPrimaryRace" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from active plan terminal races.
UPDATE "athlete_races" AS ar
SET "isPrimaryRace" = true
FROM "training_plans" AS tp
WHERE tp."athleteRaceId" = ar."id"
  AND tp."lifecycleStatus" = 'ACTIVE'
  AND tp."athleteId" = ar."athleteId";

CREATE INDEX "athlete_races_athleteId_isPrimaryRace_idx"
  ON "athlete_races" ("athleteId", "isPrimaryRace");

CREATE UNIQUE INDEX "athlete_races_one_primary_per_athlete"
  ON "athlete_races" ("athleteId")
  WHERE "isPrimaryRace" = true;
