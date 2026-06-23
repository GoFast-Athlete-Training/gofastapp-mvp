-- CreateTable
CREATE TABLE "race_registry_course_segments" (
    "id" TEXT NOT NULL,
    "raceRegistryId" TEXT NOT NULL,
    "companySegmentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mileMarker" TEXT,
    "description" TEXT,
    "runTip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_registry_course_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "race_registry_course_segments_companySegmentId_key" ON "race_registry_course_segments"("companySegmentId");

-- CreateIndex
CREATE INDEX "race_registry_course_segments_raceRegistryId_idx" ON "race_registry_course_segments"("raceRegistryId");

-- AddForeignKey
ALTER TABLE "race_registry_course_segments" ADD CONSTRAINT "race_registry_course_segments_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
