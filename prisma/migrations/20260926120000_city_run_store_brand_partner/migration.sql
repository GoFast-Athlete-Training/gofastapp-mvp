-- CreateTable
CREATE TABLE "run_stores" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "city" TEXT,
    "state" TEXT,
    "formattedAddress" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_stores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "run_stores_slug_key" ON "run_stores"("slug");

-- AlterTable
ALTER TABLE "city_runs" ADD COLUMN "runStoreId" TEXT;
ALTER TABLE "city_runs" ADD COLUMN "partnerBrandId" TEXT;

-- CreateIndex
CREATE INDEX "city_runs_runStoreId_idx" ON "city_runs"("runStoreId");
CREATE INDEX "city_runs_partnerBrandId_idx" ON "city_runs"("partnerBrandId");

-- AddForeignKey
ALTER TABLE "city_runs" ADD CONSTRAINT "city_runs_runStoreId_fkey" FOREIGN KEY ("runStoreId") REFERENCES "run_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "city_runs" ADD CONSTRAINT "city_runs_partnerBrandId_fkey" FOREIGN KEY ("partnerBrandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
