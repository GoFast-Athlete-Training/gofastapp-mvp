-- Preset: weekly type shares + rename long-run pool; drop legacy quality fields.
-- run_type_config: workoutType; position label column removed (catalogue is source of truth).

ALTER TABLE "preset_volume_constraints" ADD COLUMN IF NOT EXISTS "longRunWeekPct" DOUBLE PRECISION NOT NULL DEFAULT 25;
ALTER TABLE "preset_volume_constraints" ADD COLUMN IF NOT EXISTS "tempoWeekPct" DOUBLE PRECISION NOT NULL DEFAULT 10;
ALTER TABLE "preset_volume_constraints" ADD COLUMN IF NOT EXISTS "intervalsWeekPct" DOUBLE PRECISION NOT NULL DEFAULT 7;

ALTER TABLE "preset_volume_constraints" RENAME COLUMN "cyclePeakPool" TO "longRunPeakPool";

ALTER TABLE "preset_workout_config" DROP COLUMN IF EXISTS "qualityFraction";
ALTER TABLE "preset_workout_config" DROP COLUMN IF EXISTS "qualityOnLongRun";

ALTER TABLE "run_type_config" ADD COLUMN "workoutType" "WorkoutType" NOT NULL DEFAULT 'LongRun';

CREATE INDEX "run_type_config_workoutType_idx" ON "run_type_config"("workoutType");

ALTER TABLE "run_type_config_position" DROP COLUMN IF EXISTS "name";
