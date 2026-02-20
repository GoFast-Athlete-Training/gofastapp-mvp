-- AlterTable - source is freeform text (not enum) for flexibility
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;

-- Set default for existing runs
UPDATE "city_runs" SET "source" = 'Manual entry' WHERE "source" IS NULL;
