-- Add cyclePoolData JSON column to training_plans for generation debug / preview
-- IF NOT EXISTS: safe if column was added manually during invalid migration name incident
ALTER TABLE "training_plans" ADD COLUMN IF NOT EXISTS "cyclePoolData" JSONB;
