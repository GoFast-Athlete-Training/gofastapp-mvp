-- CreateEnum
CREATE TYPE "InstanceType" AS ENUM ('STANDALONE', 'SERIES');

-- AlterTable: add instanceType to city_runs with default STANDALONE
ALTER TABLE "city_runs" ADD COLUMN "instanceType" "InstanceType" NOT NULL DEFAULT 'STANDALONE';

-- Backfill: runs with dayOfWeek set are series
UPDATE "city_runs" SET "instanceType" = 'SERIES' WHERE "dayOfWeek" IS NOT NULL AND "dayOfWeek" != '';

-- CreateIndex
CREATE INDEX "city_runs_instanceType_idx" ON "city_runs"("instanceType");
