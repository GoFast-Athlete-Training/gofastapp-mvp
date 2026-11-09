-- Drop duplicate / legacy columns from training_plan_preset (facts live on build_preset + phase presets).

ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "coachPlanOverview";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "workoutStructure";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "longRunCycleWeeks";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "baseLongRunPoolMiles";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "peakLongRunPoolMiles";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "taperLongRunPoolMiles";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "longRunConfigId";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "intervalsConfigId";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "tempoConfigId";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "easyConfigId";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "easyRunConfig";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "presetPhaseGenerateJson";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "snapPeakLongRunMiles";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "snapPeakWeeklyMiles";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "snapTaperWeek1TotalMiles";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "snapTaperWeek1LongRunMiles";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "snapTaperWeek2TotalMiles";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "snapTaperWeek2LongRunMiles";
