-- CreateEnum
CREATE TYPE "RunWorkflowStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- AlterTable
ALTER TABLE "city_runs" ADD COLUMN "workflowStatus" "RunWorkflowStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "city_runs_workflowStatus_idx" ON "city_runs"("workflowStatus");
