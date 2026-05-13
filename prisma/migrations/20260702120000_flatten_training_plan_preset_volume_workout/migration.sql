-- Flatten preset_volume_constraints + preset_workout_config onto training_plan_preset.

ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "cycleLen" INTEGER;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "minWeeklyMiles" INTEGER;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "maxWeeklyMiles" INTEGER;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "baseMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "peakMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "taperMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "tempoIdealDow" INTEGER;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "intervalIdealDow" INTEGER;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "longRunDefaultDow" INTEGER;

UPDATE "training_plan_preset" AS t
SET
  "cycleLen" = v."cycleLen",
  "minWeeklyMiles" = v."minWeeklyMiles",
  "maxWeeklyMiles" = v."maxWeeklyMiles",
  "baseMiles" = v."baseMiles",
  "peakMiles" = v."peakMiles",
  "taperMiles" = v."taperMiles"
FROM "preset_volume_constraints" AS v
WHERE v."presetId" = t."id";

UPDATE "training_plan_preset" AS t
SET
  "tempoIdealDow" = w."tempoIdealDow",
  "intervalIdealDow" = w."intervalIdealDow",
  "longRunDefaultDow" = w."longRunDefaultDow"
FROM "preset_workout_config" AS w
WHERE w."presetId" = t."id";

UPDATE "training_plan_preset" SET "cycleLen" = 4 WHERE "cycleLen" IS NULL;
UPDATE "training_plan_preset" SET "minWeeklyMiles" = 40 WHERE "minWeeklyMiles" IS NULL;
UPDATE "training_plan_preset" SET "baseMiles" = 8 WHERE "baseMiles" IS NULL;
UPDATE "training_plan_preset" SET "peakMiles" = 18 WHERE "peakMiles" IS NULL;
UPDATE "training_plan_preset" SET "taperMiles" = 12 WHERE "taperMiles" IS NULL;
UPDATE "training_plan_preset" SET "tempoIdealDow" = 2 WHERE "tempoIdealDow" IS NULL;
UPDATE "training_plan_preset" SET "intervalIdealDow" = 4 WHERE "intervalIdealDow" IS NULL;
UPDATE "training_plan_preset" SET "longRunDefaultDow" = 6 WHERE "longRunDefaultDow" IS NULL;

ALTER TABLE "training_plan_preset" ALTER COLUMN "cycleLen" SET NOT NULL;
ALTER TABLE "training_plan_preset" ALTER COLUMN "minWeeklyMiles" SET NOT NULL;
ALTER TABLE "training_plan_preset" ALTER COLUMN "baseMiles" SET NOT NULL;
ALTER TABLE "training_plan_preset" ALTER COLUMN "peakMiles" SET NOT NULL;
ALTER TABLE "training_plan_preset" ALTER COLUMN "taperMiles" SET NOT NULL;
ALTER TABLE "training_plan_preset" ALTER COLUMN "tempoIdealDow" SET NOT NULL;
ALTER TABLE "training_plan_preset" ALTER COLUMN "intervalIdealDow" SET NOT NULL;
ALTER TABLE "training_plan_preset" ALTER COLUMN "longRunDefaultDow" SET NOT NULL;

ALTER TABLE "training_plan_preset" ALTER COLUMN "cycleLen" SET DEFAULT 4;
ALTER TABLE "training_plan_preset" ALTER COLUMN "minWeeklyMiles" SET DEFAULT 40;
ALTER TABLE "training_plan_preset" ALTER COLUMN "tempoIdealDow" SET DEFAULT 2;
ALTER TABLE "training_plan_preset" ALTER COLUMN "intervalIdealDow" SET DEFAULT 4;
ALTER TABLE "training_plan_preset" ALTER COLUMN "longRunDefaultDow" SET DEFAULT 6;

DROP TABLE IF EXISTS "preset_volume_constraints";
DROP TABLE IF EXISTS "preset_workout_config";
