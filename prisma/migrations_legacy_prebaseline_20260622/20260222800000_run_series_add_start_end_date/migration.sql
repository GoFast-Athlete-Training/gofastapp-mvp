-- Add startDate and endDate to run_series if missing (schema expects them; DB may have been migrated out of order)
-- startDate: when this series began; null = from whenever
-- endDate: when this series ends; null = forever

ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
