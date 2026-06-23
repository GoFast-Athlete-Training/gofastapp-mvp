-- AlterTable
ALTER TABLE "race_registry" ADD COLUMN "companyRaceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "race_registry_companyRaceId_key" ON "race_registry"("companyRaceId");
