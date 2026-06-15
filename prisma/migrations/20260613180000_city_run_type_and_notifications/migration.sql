-- CreateEnum
CREATE TYPE "CityRunType" AS ENUM ('CLUB', 'INDIVIDUAL', 'RACE_SHAKEOUT', 'RUN_CREW', 'OTHER');

-- AlterTable
ALTER TABLE "city_runs" ADD COLUMN "cityRunType" "CityRunType" NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX "city_runs_cityRunType_idx" ON "city_runs"("cityRunType");

-- Backfill cityRunType
UPDATE "city_runs" SET "cityRunType" = 'CLUB' WHERE "runClubId" IS NOT NULL;
UPDATE "city_runs" SET "cityRunType" = 'RACE_SHAKEOUT'
  WHERE "cityRunType" = 'OTHER' AND ("shakeoutDedupeKey" IS NOT NULL OR "raceRegistryId" IS NOT NULL);
UPDATE "city_runs" SET "cityRunType" = 'RUN_CREW'
  WHERE "cityRunType" = 'OTHER' AND "runCrewId" IS NOT NULL;
UPDATE "city_runs" SET "cityRunType" = 'INDIVIDUAL'
  WHERE "cityRunType" = 'OTHER' AND "athleteGeneratedId" IS NOT NULL;

-- CreateTable
CREATE TABLE "athlete_push_tokens" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "platform" TEXT,
    "deviceId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_notifications" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deeplink" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_push_tokens_expoPushToken_key" ON "athlete_push_tokens"("expoPushToken");
CREATE INDEX "athlete_push_tokens_athleteId_idx" ON "athlete_push_tokens"("athleteId");
CREATE UNIQUE INDEX "athlete_notifications_dedupeKey_key" ON "athlete_notifications"("dedupeKey");
CREATE INDEX "athlete_notifications_athleteId_readAt_idx" ON "athlete_notifications"("athleteId", "readAt");
CREATE INDEX "athlete_notifications_scheduledFor_sentAt_idx" ON "athlete_notifications"("scheduledFor", "sentAt");

-- AddForeignKey
ALTER TABLE "athlete_push_tokens" ADD CONSTRAINT "athlete_push_tokens_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "athlete_notifications" ADD CONSTRAINT "athlete_notifications_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
