-- Plan gen quality refactor: catalogue isQuality, preset qualityFraction, training plan quality days

ALTER TABLE "workout_catalogue" ADD COLUMN "isQuality" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workout_catalogue" ALTER COLUMN "progressionIndex" DROP NOT NULL;

ALTER TABLE "preset_workout_config" ADD COLUMN "qualityFraction" DOUBLE PRECISION NOT NULL DEFAULT 0.22;
ALTER TABLE "preset_workout_config" ADD COLUMN "qualitySessions" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "preset_workout_config" ADD COLUMN "qualityOnLongRun" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "preset_workout_config" DROP COLUMN "tempoStartMiles";
ALTER TABLE "preset_workout_config" DROP COLUMN "intervalStartMiles";
ALTER TABLE "preset_workout_config" DROP COLUMN "minTempoMiles";
ALTER TABLE "preset_workout_config" DROP COLUMN "minIntervalMiles";

ALTER TABLE "training_plans" ADD COLUMN "preferredQualityDays" INTEGER[] NOT NULL DEFAULT '{}';
