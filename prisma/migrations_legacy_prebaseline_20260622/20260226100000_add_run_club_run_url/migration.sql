-- Add runUrl to run_clubs: "runs" page URL as single source of truth for where run/series info came from (seed/hydrate for data entry)
ALTER TABLE "run_clubs" ADD COLUMN IF NOT EXISTS "runUrl" TEXT;
