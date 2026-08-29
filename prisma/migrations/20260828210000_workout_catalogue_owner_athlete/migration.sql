-- Athlete-owned catalogue rows for preset rotation picks (staff rows keep ownerAthleteId NULL).

ALTER TABLE "workout_catalogue" ADD COLUMN "ownerAthleteId" TEXT;

ALTER TABLE "workout_catalogue"
  ADD CONSTRAINT "workout_catalogue_ownerAthleteId_fkey"
  FOREIGN KEY ("ownerAthleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "workout_catalogue_name_workoutType_key";

CREATE UNIQUE INDEX "workout_catalogue_staff_name_workoutType_key"
  ON "workout_catalogue"("name", "workoutType")
  WHERE "ownerAthleteId" IS NULL;

CREATE UNIQUE INDEX "workout_catalogue_athlete_name_workoutType_key"
  ON "workout_catalogue"("name", "workoutType", "ownerAthleteId")
  WHERE "ownerAthleteId" IS NOT NULL;

CREATE INDEX "workout_catalogue_ownerAthleteId_idx" ON "workout_catalogue"("ownerAthleteId");
