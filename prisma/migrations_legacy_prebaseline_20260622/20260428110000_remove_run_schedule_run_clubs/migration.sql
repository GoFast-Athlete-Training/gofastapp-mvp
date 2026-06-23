-- Drop legacy serialized club schedule string; series live in run_series.
ALTER TABLE "run_clubs" DROP COLUMN IF EXISTS "runSchedule";
