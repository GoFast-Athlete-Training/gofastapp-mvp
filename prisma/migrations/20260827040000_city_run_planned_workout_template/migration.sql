-- Club session prescribe template on city_runs; nullable athlete on template rows.

ALTER TABLE "planned_workouts" ALTER COLUMN "athleteId" DROP NOT NULL;

ALTER TABLE "city_runs" ADD COLUMN "plannedWorkoutId" TEXT;

CREATE UNIQUE INDEX "city_runs_plannedWorkoutId_key" ON "city_runs"("plannedWorkoutId");

ALTER TABLE "city_runs" ADD CONSTRAINT "city_runs_plannedWorkoutId_fkey"
  FOREIGN KEY ("plannedWorkoutId") REFERENCES "planned_workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One club template per city run (athleteId null, no training plan).
CREATE UNIQUE INDEX "planned_workouts_club_template_cityRunId_key"
  ON "planned_workouts"("cityRunId")
  WHERE "athleteId" IS NULL AND "planId" IS NULL;
