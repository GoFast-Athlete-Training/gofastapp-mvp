-- Host vs going on city_run_rsvps junction (MyDay widgets).
ALTER TABLE "city_run_rsvps" ADD COLUMN "role" TEXT;

-- Legacy host auto-RSVPs: athlete on city_runs.athleteGeneratedId.
UPDATE "city_run_rsvps" AS r
SET "role" = 'host'
FROM "city_runs" AS cr
WHERE cr.id = r."runId"
  AND cr."athleteGeneratedId" = r."athleteId"
  AND r.status = 'going';

-- Remaining going RSVPs.
UPDATE "city_run_rsvps"
SET "role" = 'going'
WHERE "role" IS NULL
  AND status = 'going';

CREATE INDEX "city_run_rsvps_athleteId_role_idx" ON "city_run_rsvps"("athleteId", "role");
