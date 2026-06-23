-- AlterTable
ALTER TABLE "run_crews" ADD COLUMN "messageTopics" JSONB;

-- AlterTable
ALTER TABLE "run_crew_messages" ADD COLUMN "topic" TEXT NOT NULL DEFAULT 'general';

