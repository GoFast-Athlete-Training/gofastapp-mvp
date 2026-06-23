-- Create new enum with four-stage workflow
CREATE TYPE "RunWorkflowStatus_new" AS ENUM ('DEVELOP', 'PENDING', 'SUBMITTED', 'APPROVED');

-- Migrate existing values:
-- Old DRAFT represented queue/pending work, so map DRAFT -> PENDING
ALTER TABLE "city_runs"
  ALTER COLUMN "workflowStatus" DROP DEFAULT,
  ALTER COLUMN "workflowStatus" TYPE "RunWorkflowStatus_new"
  USING (
    CASE
      WHEN "workflowStatus"::text = 'DRAFT' THEN 'PENDING'
      ELSE "workflowStatus"::text
    END
  )::"RunWorkflowStatus_new";

-- Replace old enum
ALTER TYPE "RunWorkflowStatus" RENAME TO "RunWorkflowStatus_old";
ALTER TYPE "RunWorkflowStatus_new" RENAME TO "RunWorkflowStatus";
DROP TYPE "RunWorkflowStatus_old";

-- New default
ALTER TABLE "city_runs"
  ALTER COLUMN "workflowStatus" SET DEFAULT 'DEVELOP';
