-- city_run_checkins: junction table Athlete <-> CityRun
-- Check-in = the athlete actually showed up. Distinct from RSVP (intent).
-- This is the membership gate for CityRunPostRunContainer.

CREATE TABLE "city_run_checkins" (
  "id"          TEXT NOT NULL,
  "runId"       TEXT NOT NULL,
  "athleteId"   TEXT NOT NULL,
  "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "runPhotoUrl" TEXT,
  "runShouts"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "city_run_checkins_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "city_run_checkins"
  ADD CONSTRAINT "city_run_checkins_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "city_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "city_run_checkins"
  ADD CONSTRAINT "city_run_checkins_athleteId_fkey"
  FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "city_run_checkins_runId_athleteId_key" ON "city_run_checkins"("runId", "athleteId");
CREATE INDEX "city_run_checkins_runId_idx" ON "city_run_checkins"("runId");
CREATE INDEX "city_run_checkins_athleteId_idx" ON "city_run_checkins"("athleteId");
