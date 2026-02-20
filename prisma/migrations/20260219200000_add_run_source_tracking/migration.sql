-- CreateEnum
CREATE TYPE "RunSource" AS ENUM ('STRAVA', 'WEB', 'MANUAL', 'AI_GENERATED', 'IMPORT');

-- AlterTable
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "source" "RunSource";
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;

-- Set default for existing runs
UPDATE "city_runs" SET "source" = 'MANUAL' WHERE "source" IS NULL;
