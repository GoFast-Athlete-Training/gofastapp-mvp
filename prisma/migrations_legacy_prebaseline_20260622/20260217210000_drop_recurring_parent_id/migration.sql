-- Drop recurring parent/child relation (MVP2). All runs are single events in MVP1.

ALTER TABLE "city_runs" DROP CONSTRAINT IF EXISTS "city_runs_recurringParentId_fkey";
DROP INDEX IF EXISTS "city_runs_recurringParentId_idx";
ALTER TABLE "city_runs" DROP COLUMN IF EXISTS "recurringParentId";
