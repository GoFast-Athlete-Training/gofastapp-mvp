-- Catalog preset ids now reference Training Manage rows (no prod training_plan_preset FK).

ALTER TABLE "training_plans" DROP CONSTRAINT IF EXISTS "training_plans_presetId_fkey";
ALTER TABLE "athlete_presets" DROP CONSTRAINT IF EXISTS "athlete_presets_sourcePresetId_fkey";
ALTER TABLE "athlete_presets" DROP CONSTRAINT IF EXISTS "athlete_presets_promotedPresetId_fkey";
ALTER TABLE "training_cohorts" DROP CONSTRAINT IF EXISTS "training_cohorts_presetId_fkey";
ALTER TABLE "public_training_plans" DROP CONSTRAINT IF EXISTS "public_training_plans_sourcePresetId_fkey";
