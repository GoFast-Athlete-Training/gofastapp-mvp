-- Add discoverability flag on city_runs (runs only — not run_series).
ALTER TABLE "city_runs" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;

-- Preserve visibility for runs that were already live under workflowStatus gating.
UPDATE "city_runs"
SET "published" = true
WHERE "workflowStatus" IN ('PENDING', 'SUBMITTED', 'APPROVED');
