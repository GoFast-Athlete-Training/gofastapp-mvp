-- AlterTable
ALTER TABLE "athlete_races" ADD COLUMN "raceWeekOutNotifiedAt" TIMESTAMP(3),
ADD COLUMN "raceDayBeforeNotifiedAt" TIMESTAMP(3),
ADD COLUMN "raceDayNotifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "race_triggers" (
    "id" TEXT NOT NULL,
    "raceRegistryId" TEXT NOT NULL,
    "raceDate" TIMESTAMP(3) NOT NULL,
    "weekOutDate" TIMESTAMP(3) NOT NULL,
    "reminderDate" TIMESTAMP(3) NOT NULL,
    "weekOutProductEventSlug" TEXT NOT NULL DEFAULT 'race.week_out',
    "reminderProductEventSlug" TEXT NOT NULL DEFAULT 'race.day_before',
    "raceDayProductEventSlug" TEXT NOT NULL DEFAULT 'race.race_day',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "race_trigger_athletes" (
    "id" TEXT NOT NULL,
    "raceTriggerId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "athleteRaceId" TEXT NOT NULL,
    "notifyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_trigger_athletes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "race_triggers_raceRegistryId_key" ON "race_triggers"("raceRegistryId");

-- CreateIndex
CREATE INDEX "race_triggers_weekOutDate_idx" ON "race_triggers"("weekOutDate");

-- CreateIndex
CREATE INDEX "race_triggers_reminderDate_idx" ON "race_triggers"("reminderDate");

-- CreateIndex
CREATE INDEX "race_triggers_raceDate_idx" ON "race_triggers"("raceDate");

-- CreateIndex
CREATE UNIQUE INDEX "race_trigger_athletes_athleteRaceId_key" ON "race_trigger_athletes"("athleteRaceId");

-- CreateIndex
CREATE INDEX "race_trigger_athletes_athleteId_idx" ON "race_trigger_athletes"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "race_trigger_athletes_raceTriggerId_athleteId_key" ON "race_trigger_athletes"("raceTriggerId", "athleteId");

-- AddForeignKey
ALTER TABLE "race_triggers" ADD CONSTRAINT "race_triggers_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_trigger_athletes" ADD CONSTRAINT "race_trigger_athletes_raceTriggerId_fkey" FOREIGN KEY ("raceTriggerId") REFERENCES "race_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_trigger_athletes" ADD CONSTRAINT "race_trigger_athletes_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_trigger_athletes" ADD CONSTRAINT "race_trigger_athletes_athleteRaceId_fkey" FOREIGN KEY ("athleteRaceId") REFERENCES "athlete_races"("id") ON DELETE CASCADE ON UPDATE CASCADE;
