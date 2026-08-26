-- Expand athlete_presets into a full athlete-owned blueprint (volume + rotations + pace).

ALTER TABLE "athlete_presets" ADD COLUMN IF NOT EXISTS "coachPlanOverview" JSONB;
ALTER TABLE "athlete_presets" ADD COLUMN IF NOT EXISTS "paceProfile" JSONB;
ALTER TABLE "athlete_presets" ADD COLUMN IF NOT EXISTS "workoutStructure" JSONB;
ALTER TABLE "athlete_presets" ADD COLUMN IF NOT EXISTS "easyRunConfig" JSONB;

ALTER TABLE "athlete_presets" ADD COLUMN IF NOT EXISTS "longRunConfigId" TEXT;
ALTER TABLE "athlete_presets" ADD COLUMN IF NOT EXISTS "intervalsConfigId" TEXT;
ALTER TABLE "athlete_presets" ADD COLUMN IF NOT EXISTS "tempoConfigId" TEXT;
ALTER TABLE "athlete_presets" ADD COLUMN IF NOT EXISTS "easyConfigId" TEXT;

ALTER TABLE "athlete_presets" ADD CONSTRAINT "athlete_presets_longRunConfigId_fkey"
  FOREIGN KEY ("longRunConfigId") REFERENCES "long_run_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "athlete_presets" ADD CONSTRAINT "athlete_presets_intervalsConfigId_fkey"
  FOREIGN KEY ("intervalsConfigId") REFERENCES "intervals_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "athlete_presets" ADD CONSTRAINT "athlete_presets_tempoConfigId_fkey"
  FOREIGN KEY ("tempoConfigId") REFERENCES "tempo_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "athlete_presets" ADD CONSTRAINT "athlete_presets_easyConfigId_fkey"
  FOREIGN KEY ("easyConfigId") REFERENCES "easy_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
