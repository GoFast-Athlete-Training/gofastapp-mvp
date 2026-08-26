-- City Run stamp on planned_workouts + club matchToken

ALTER TABLE "run_clubs" ADD COLUMN IF NOT EXISTS "matchToken" TEXT;

ALTER TABLE "planned_workouts" ALTER COLUMN "planId" DROP NOT NULL;

ALTER TABLE "planned_workouts" ADD COLUMN IF NOT EXISTS "cityRunId" TEXT;
ALTER TABLE "planned_workouts" ADD COLUMN IF NOT EXISTS "courseSnapJson" JSONB;
ALTER TABLE "planned_workouts" ADD COLUMN IF NOT EXISTS "cityRunMatchLabel" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "planned_workouts_athleteId_cityRunId_key"
  ON "planned_workouts"("athleteId", "cityRunId");

CREATE INDEX IF NOT EXISTS "planned_workouts_cityRunId_idx"
  ON "planned_workouts"("cityRunId");

ALTER TABLE "planned_workouts"
  ADD CONSTRAINT "planned_workouts_cityRunId_fkey"
  FOREIGN KEY ("cityRunId") REFERENCES "city_runs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
