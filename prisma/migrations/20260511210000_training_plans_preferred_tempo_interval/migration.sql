-- AlterTable
ALTER TABLE "training_plans" ADD COLUMN "preferredTempoDow" INTEGER;
ALTER TABLE "training_plans" ADD COLUMN "preferredIntervalDow" INTEGER;

-- Backfill from legacy preferredQualityDays array (1-based subscripts in PostgreSQL)
UPDATE "training_plans"
SET "preferredTempoDow" = "preferredQualityDays"[1]
WHERE cardinality("preferredQualityDays") >= 1 AND "preferredTempoDow" IS NULL;

UPDATE "training_plans"
SET "preferredIntervalDow" = "preferredQualityDays"[2]
WHERE cardinality("preferredQualityDays") >= 2 AND "preferredIntervalDow" IS NULL;
