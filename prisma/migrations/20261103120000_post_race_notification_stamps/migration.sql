-- Post-race push dedupe stamps
ALTER TABLE "athlete_races" ADD COLUMN IF NOT EXISTS "nextPlanReadyNotifiedAt" TIMESTAMP(3);
ALTER TABLE "athlete_race_results" ADD COLUMN IF NOT EXISTS "prCongratsNotifiedAt" TIMESTAMP(3);
