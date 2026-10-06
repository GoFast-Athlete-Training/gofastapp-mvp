-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_slug_key" ON "regions"("slug");

-- CreateIndex
CREATE INDEX "regions_slug_idx" ON "regions"("slug");

-- AlterTable
ALTER TABLE "cities" ADD COLUMN "regionId" TEXT;

-- CreateIndex
CREATE INDEX "cities_regionId_idx" ON "cities"("regionId");

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed DMV region
INSERT INTO "regions" ("id", "slug", "name", "updatedAt")
VALUES ('dmv', 'dmv', 'DMV', CURRENT_TIMESTAMP);

-- Ensure metro cities exist and point at DMV
INSERT INTO "cities" ("id", "slug", "name", "regionId", "updatedAt")
VALUES
  ('dc', 'dc', 'Washington', 'dmv', CURRENT_TIMESTAMP),
  ('arlington', 'arlington', 'Arlington', 'dmv', CURRENT_TIMESTAMP),
  ('bethesda', 'bethesda', 'Bethesda', 'dmv', CURRENT_TIMESTAMP),
  ('alexandria', 'alexandria', 'Alexandria', 'dmv', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "regionId" = EXCLUDED."regionId",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "cities"
SET "regionId" = 'dmv', "updatedAt" = CURRENT_TIMESTAMP
WHERE LOWER("slug") IN ('dc', 'arlington', 'bethesda', 'alexandria');

-- Backfill run region stamps to DMV metro key
UPDATE "city_runs"
SET "regionSlug" = 'dmv'
WHERE LOWER("citySlug") IN ('dc', 'arlington', 'bethesda', 'alexandria')
   OR "regionSlug" = 'dc';
