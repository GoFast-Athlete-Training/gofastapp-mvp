-- Civil calendar day for city runs (ingest SOT). `date` remains sort anchor only.

ALTER TABLE "city_runs" ADD COLUMN "runDay" TEXT;

-- One-time backfill: civil day in event timezone from stored anchor instant.
UPDATE "city_runs"
SET "runDay" = to_char(
  ("date" AT TIME ZONE 'UTC') AT TIME ZONE COALESCE(NULLIF(trim("timezone"), ''), 'America/New_York'),
  'YYYY-MM-DD'
)
WHERE "runDay" IS NULL;

CREATE INDEX "city_runs_runDay_idx" ON "city_runs"("runDay");
