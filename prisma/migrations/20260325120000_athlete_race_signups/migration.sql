-- CreateTable
CREATE TABLE "athlete_race_signups" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "raceRegistryId" TEXT NOT NULL,
    "selfDeclaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "goalId" TEXT,
    "notifyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_race_signups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_race_signups_athleteId_raceRegistryId_key" ON "athlete_race_signups"("athleteId", "raceRegistryId");

-- CreateIndex
CREATE INDEX "athlete_race_signups_athleteId_idx" ON "athlete_race_signups"("athleteId");

-- CreateIndex
CREATE INDEX "athlete_race_signups_raceRegistryId_idx" ON "athlete_race_signups"("raceRegistryId");

-- AddForeignKey
ALTER TABLE "athlete_race_signups" ADD CONSTRAINT "athlete_race_signups_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_race_signups" ADD CONSTRAINT "athlete_race_signups_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_race_signups" ADD CONSTRAINT "athlete_race_signups_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "athlete_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
