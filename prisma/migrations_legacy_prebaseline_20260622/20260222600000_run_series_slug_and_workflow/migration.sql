-- Add slug and workflowStatus to run_series (STUBBED = just created, PENDING = assigned to VA cue)
CREATE TYPE "SeriesWorkflowStatus" AS ENUM ('STUBBED', 'PENDING');

ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "workflowStatus" "SeriesWorkflowStatus" NOT NULL DEFAULT 'STUBBED';

CREATE UNIQUE INDEX IF NOT EXISTS "run_series_slug_key" ON "run_series"("slug");
CREATE INDEX IF NOT EXISTS "run_series_workflowStatus_idx" ON "run_series"("workflowStatus");
