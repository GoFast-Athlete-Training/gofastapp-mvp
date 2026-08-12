-- Evolve athlete_race_signups → athlete_races snapshot working set

ALTER TABLE "athlete_race_signups" RENAME TO "athlete_races";

-- Snapshot columns (backfill from catalog, then enforce NOT NULL on core fields)
ALTER TABLE "athlete_races" ADD COLUMN "name" TEXT;
ALTER TABLE "athlete_races" ADD COLUMN "raceDate" TIMESTAMP(3);
ALTER TABLE "athlete_races" ADD COLUMN "distanceMeters" INTEGER;
ALTER TABLE "athlete_races" ADD COLUMN "distanceLabel" TEXT;
ALTER TABLE "athlete_races" ADD COLUMN "city" TEXT;
ALTER TABLE "athlete_races" ADD COLUMN "state" TEXT;

UPDATE "athlete_races" ar
SET
  "name" = rr."name",
  "raceDate" = rr."raceDate",
  "distanceMeters" = rr."distanceMeters",
  "distanceLabel" = rr."distanceLabel",
  "city" = rr."city",
  "state" = rr."state"
FROM "race_registry" rr
WHERE ar."raceRegistryId" = rr."id";

ALTER TABLE "athlete_races" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "athlete_races" ALTER COLUMN "raceDate" SET NOT NULL;

CREATE INDEX "athlete_races_raceDate_idx" ON "athlete_races"("raceDate");

-- Goals hang on athlete races
ALTER TABLE "athlete_goals" ADD COLUMN "athleteRaceId" TEXT;

UPDATE "athlete_goals" g
SET "athleteRaceId" = ar."id"
FROM "athlete_races" ar
WHERE g."athleteId" = ar."athleteId"
  AND g."raceRegistryId" = ar."raceRegistryId"
  AND g."athleteRaceId" IS NULL;

UPDATE "athlete_goals" g
SET "athleteRaceId" = ar."id"
FROM "athlete_races" ar
WHERE ar."goalId" = g."id"
  AND g."athleteRaceId" IS NULL;

ALTER TABLE "athlete_goals" ADD CONSTRAINT "athlete_goals_athleteRaceId_fkey"
  FOREIGN KEY ("athleteRaceId") REFERENCES "athlete_races"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "athlete_goals_athleteRaceId_idx" ON "athlete_goals"("athleteRaceId");

-- Drop signup.goalId (rejected canon)
ALTER TABLE "athlete_races" DROP CONSTRAINT "athlete_race_signups_goalId_fkey";
ALTER TABLE "athlete_races" DROP COLUMN "goalId";

-- Plan terminal athlete race (user pick)
ALTER TABLE "training_plans" ADD COLUMN "primaryAthleteRaceId" TEXT;

UPDATE "training_plans" tp
SET "primaryAthleteRaceId" = ar."id"
FROM "athlete_races" ar
WHERE tp."athleteId" = ar."athleteId"
  AND tp."raceId" = ar."raceRegistryId"
  AND tp."primaryAthleteRaceId" IS NULL;

ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_primaryAthleteRaceId_fkey"
  FOREIGN KEY ("primaryAthleteRaceId") REFERENCES "athlete_races"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "training_plans_primaryAthleteRaceId_idx" ON "training_plans"("primaryAthleteRaceId");

-- Plan race events + results use athleteRaceId
ALTER TABLE "training_plan_race_events" RENAME COLUMN "athleteRaceSignupId" TO "athleteRaceId";

ALTER TABLE "athlete_race_results" RENAME COLUMN "signupId" TO "athleteRaceId";
