-- Drop AI prompt system tables (deprecated — generation logic is deterministic, not LLM-driven)

-- DropForeignKey
ALTER TABLE "prompt_instructions" DROP CONSTRAINT IF EXISTS "prompt_instructions_promptId_fkey";

ALTER TABLE "training_gen_prompts" DROP CONSTRAINT IF EXISTS "training_gen_prompts_aiRoleId_fkey";
ALTER TABLE "training_gen_prompts" DROP CONSTRAINT IF EXISTS "training_gen_prompts_mustHavesId_fkey";
ALTER TABLE "training_gen_prompts" DROP CONSTRAINT IF EXISTS "training_gen_prompts_returnFormatId_fkey";
ALTER TABLE "training_gen_prompts" DROP CONSTRAINT IF EXISTS "training_gen_prompts_ruleSetId_fkey";

ALTER TABLE "rule_set_items" DROP CONSTRAINT IF EXISTS "rule_set_items_topicId_fkey";
ALTER TABLE "rule_set_topics" DROP CONSTRAINT IF EXISTS "rule_set_topics_rulesetId_fkey";

-- DropTable
DROP TABLE IF EXISTS "training_gen_prompts";
DROP TABLE IF EXISTS "prompt_instructions";
DROP TABLE IF EXISTS "ai_roles";
DROP TABLE IF EXISTS "must_haves";
DROP TABLE IF EXISTS "return_json_formats";
DROP TABLE IF EXISTS "rule_set_items";
DROP TABLE IF EXISTS "rule_set_topics";
DROP TABLE IF EXISTS "rule_sets";
DROP TABLE IF EXISTS "training_schemas";

-- CreateEnum
CREATE TYPE "CoachReviewStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable: plan_gen_config
CREATE TABLE "plan_gen_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "taperWeeks" INTEGER NOT NULL DEFAULT 3,
    "peakWeeks" INTEGER NOT NULL DEFAULT 4,
    "taperLongRunAnchors" JSONB NOT NULL,
    "peakLongRunMiles" INTEGER NOT NULL DEFAULT 22,
    "cutbackWeekModulo" INTEGER NOT NULL DEFAULT 3,
    "weeklyMileageMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "taperMileageReduction" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "longRunCapFraction" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "minWeeklyMiles" INTEGER NOT NULL DEFAULT 40,
    "tempoStartMiles" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "intervalStartMiles" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "minTempoMiles" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "minIntervalMiles" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "minLongMiles" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "minEasyPerDayMiles" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "minEasyWeekMiles" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "tempoIdealDow" INTEGER NOT NULL DEFAULT 2,
    "intervalIdealDow" INTEGER NOT NULL DEFAULT 4,
    "longRunDefaultDow" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_gen_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_gen_config_slug_key" ON "plan_gen_config"("slug");

-- AlterTable: training_plans — add configId, coachReviewStatus, publish fields
ALTER TABLE "training_plans"
    ADD COLUMN IF NOT EXISTS "configId" TEXT,
    ADD COLUMN IF NOT EXISTS "coachReviewStatus" "CoachReviewStatus" NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "publishedBy" TEXT;

CREATE INDEX IF NOT EXISTS "training_plans_configId_idx" ON "training_plans"("configId");

ALTER TABLE "training_plans"
    ADD CONSTRAINT "training_plans_configId_fkey"
    FOREIGN KEY ("configId") REFERENCES "plan_gen_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
