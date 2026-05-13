-- AlterTable
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "easyRunConfig" JSONB;

-- AlterTable
ALTER TABLE "training_plans" ADD COLUMN IF NOT EXISTS "easyRunConfig" JSONB;
