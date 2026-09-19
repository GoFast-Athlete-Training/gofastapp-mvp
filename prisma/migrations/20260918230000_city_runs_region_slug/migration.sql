-- AlterTable
ALTER TABLE "city_runs" ADD COLUMN "regionSlug" TEXT;

-- Backfill DC metro region from citySlug
UPDATE "city_runs"
SET "regionSlug" = 'dc'
WHERE LOWER("citySlug") IN ('dc', 'arlington', 'bethesda', 'alexandria');

-- CreateIndex
CREATE INDEX "city_runs_regionSlug_idx" ON "city_runs"("regionSlug");
