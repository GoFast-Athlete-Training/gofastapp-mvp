-- Migrate run_series.workflowStatus from SeriesWorkflowStatus → RunWorkflowStatus
-- STUBBED → DEVELOP, PENDING → PENDING

-- 1. Drop the default first (it references the old enum)
ALTER TABLE "run_series" ALTER COLUMN "workflowStatus" DROP DEFAULT;

-- 2. Convert the column to text
ALTER TABLE "run_series"
  ALTER COLUMN "workflowStatus" TYPE TEXT
  USING "workflowStatus"::text;

-- 3. Map STUBBED → DEVELOP
UPDATE "run_series" SET "workflowStatus" = 'DEVELOP' WHERE "workflowStatus" = 'STUBBED';

-- 4. Drop the old enum (now nothing references it)
DROP TYPE IF EXISTS "SeriesWorkflowStatus";

-- 5. Convert column to RunWorkflowStatus
ALTER TABLE "run_series"
  ALTER COLUMN "workflowStatus" TYPE "RunWorkflowStatus"
  USING "workflowStatus"::"RunWorkflowStatus";

-- 6. Restore default
ALTER TABLE "run_series"
  ALTER COLUMN "workflowStatus" SET DEFAULT 'DEVELOP'::"RunWorkflowStatus";
