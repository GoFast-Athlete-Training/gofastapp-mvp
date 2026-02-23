-- Drop instanceType from city_runs — the FK cityRunSetupId IS the type signal.
-- null FK = standalone run, set FK = series occurrence. No enum needed.

ALTER TABLE "city_runs" DROP COLUMN IF EXISTS "instanceType";
DROP INDEX IF EXISTS "city_runs_instanceType_idx";
DROP TYPE IF EXISTS "InstanceType";
