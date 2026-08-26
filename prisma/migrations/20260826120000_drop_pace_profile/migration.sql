-- paceProfile replaced by catalogue offsets + athlete pace adjuster columns on Athlete.
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "paceProfile";
ALTER TABLE "athlete_presets" DROP COLUMN IF EXISTS "paceProfile";
ALTER TABLE "swim_plan_preset" DROP COLUMN IF EXISTS "paceProfile";
