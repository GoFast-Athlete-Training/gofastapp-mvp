-- Drop runType column and enum. Approval state is workflowStatus only.

DROP INDEX IF EXISTS "city_runs_runType_idx";
ALTER TABLE "city_runs" DROP COLUMN IF EXISTS "runType";
DROP TYPE IF EXISTS "RunType";
