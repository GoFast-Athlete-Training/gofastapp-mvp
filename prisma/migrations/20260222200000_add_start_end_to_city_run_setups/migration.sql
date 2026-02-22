-- Add optional start/end date to city_run_setups (series validity window)
-- startDate: when this series starts; null = from whenever
-- endDate: when this series ends; null = forever / never changing

ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "city_run_setups" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
