-- CreateTable
CREATE TABLE "special_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "eventDate" TIMESTAMP(3),
    "url" TEXT,
    "brandId" TEXT,
    "partnerExtras" JSONB,
    "staffGeneratedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_events_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "city_runs" ADD COLUMN "specialEventId" TEXT;

-- CreateIndex
CREATE INDEX "special_events_brandId_idx" ON "special_events"("brandId");

-- CreateIndex
CREATE INDEX "special_events_eventDate_idx" ON "special_events"("eventDate");

-- CreateIndex
CREATE INDEX "city_runs_specialEventId_idx" ON "city_runs"("specialEventId");

-- AddForeignKey
ALTER TABLE "special_events" ADD CONSTRAINT "special_events_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_runs" ADD CONSTRAINT "city_runs_specialEventId_fkey" FOREIGN KEY ("specialEventId") REFERENCES "special_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
