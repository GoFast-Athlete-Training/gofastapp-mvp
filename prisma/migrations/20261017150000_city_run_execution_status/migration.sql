-- CreateEnum
CREATE TYPE "CityRunExecutionStatus" AS ENUM ('PLANNED', 'RAN', 'CANCELED');

-- AlterTable
ALTER TABLE "city_runs" ADD COLUMN "cityRunExecutionStatus" "CityRunExecutionStatus" NOT NULL DEFAULT 'PLANNED';
ALTER TABLE "city_runs" ADD COLUMN "executedAt" TIMESTAMP(3);
ALTER TABLE "city_runs" ADD COLUMN "canceledAt" TIMESTAMP(3);

-- Backfill club published recaps → RAN
UPDATE "city_runs"
SET "cityRunExecutionStatus" = 'RAN',
    "executedAt" = COALESCE("postRunPublishedAt", "date")
WHERE "postRunPublished" = true;
