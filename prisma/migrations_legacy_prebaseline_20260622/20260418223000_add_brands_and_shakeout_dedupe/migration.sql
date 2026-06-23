-- CreateEnum
CREATE TYPE "BrandType" AS ENUM ('SHOE', 'APPAREL', 'RUN_STORE_CHAIN', 'GEAR', 'OTHER');

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandType" "BrandType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "websiteUrl" TEXT,
    "instagramHandle" TEXT,
    "logoUrl" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- AlterTable
ALTER TABLE "run_clubs" ADD COLUMN "brandId" TEXT;

CREATE INDEX "run_clubs_brandId_idx" ON "run_clubs"("brandId");

ALTER TABLE "run_clubs" ADD CONSTRAINT "run_clubs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "city_runs" ADD COLUMN "shakeoutDedupeKey" TEXT;

CREATE UNIQUE INDEX "city_runs_shakeoutDedupeKey_key" ON "city_runs"("shakeoutDedupeKey");
