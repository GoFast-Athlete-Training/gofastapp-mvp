-- Baseline fitness lives on Athlete.fiveKPace only; remove redundant plan snapshot.
ALTER TABLE "training_plans" DROP COLUMN IF EXISTS "current5KPace";
