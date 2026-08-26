-- Athlete-scoped per-type pace adjuster (replaces preset paceProfile for generate)
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "paceAdjusterEasySecPerMile" INTEGER NOT NULL DEFAULT -10;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "paceAdjusterLongRunSecPerMile" INTEGER NOT NULL DEFAULT -20;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "paceAdjusterThresholdSecPerMile" INTEGER NOT NULL DEFAULT -20;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "paceAdjusterIntervalSecPerMile" INTEGER NOT NULL DEFAULT -10;
