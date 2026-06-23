-- Enrich athlete_race_results for goal/PR analysis and post-race UX

ALTER TABLE "athlete_race_results" ADD COLUMN IF NOT EXISTS "finishTimeSeconds" INTEGER;
ALTER TABLE "athlete_race_results" ADD COLUMN IF NOT EXISTS "goalTimeSeconds" INTEGER;
ALTER TABLE "athlete_race_results" ADD COLUMN IF NOT EXISTS "goalTimeDeltaSeconds" INTEGER;
ALTER TABLE "athlete_race_results" ADD COLUMN IF NOT EXISTS "goalAchieved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "athlete_race_results" ADD COLUMN IF NOT EXISTS "prAchieved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "athlete_race_results" ADD COLUMN IF NOT EXISTS "previousPrSeconds" INTEGER;
ALTER TABLE "athlete_race_results" ADD COLUMN IF NOT EXISTS "raceDate" TIMESTAMP(3);
ALTER TABLE "athlete_race_results" ADD COLUMN IF NOT EXISTS "distanceLabel" TEXT;
ALTER TABLE "athlete_race_results" ADD COLUMN IF NOT EXISTS "reflection" TEXT;
ALTER TABLE "athlete_race_results" ADD COLUMN IF NOT EXISTS "howFeltRating" INTEGER;

-- One logged result per goal (multiple NULLs allowed)
DROP INDEX IF EXISTS "athlete_race_results_goalId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "athlete_race_results_goalId_key" ON "athlete_race_results"("goalId");
