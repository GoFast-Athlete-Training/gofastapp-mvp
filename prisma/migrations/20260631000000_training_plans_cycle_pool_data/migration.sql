-- Add cyclePoolData JSON column to training_plans for generation debug / preview
ALTER TABLE "training_plans" ADD COLUMN "cyclePoolData" JSONB;
