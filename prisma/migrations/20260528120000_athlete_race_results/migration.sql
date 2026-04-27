-- CreateTable
CREATE TABLE "athlete_race_results" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "raceRegistryId" TEXT NOT NULL,
    "signupId" TEXT,
    "goalId" TEXT,
    "officialFinishTime" TEXT,
    "chipTime" TEXT,
    "gunTime" TEXT,
    "actualDistanceMeters" DOUBLE PRECISION,
    "actualAvgPaceSecPerMile" INTEGER,
    "overallPlace" INTEGER,
    "ageGroupPlace" INTEGER,
    "divisionPlace" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "garminActivityId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_race_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_race_results_signupId_key" ON "athlete_race_results"("signupId");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_race_results_garminActivityId_key" ON "athlete_race_results"("garminActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_race_results_athleteId_raceRegistryId_key" ON "athlete_race_results"("athleteId", "raceRegistryId");

-- CreateIndex
CREATE INDEX "athlete_race_results_athleteId_idx" ON "athlete_race_results"("athleteId");

-- CreateIndex
CREATE INDEX "athlete_race_results_raceRegistryId_idx" ON "athlete_race_results"("raceRegistryId");

-- CreateIndex
CREATE INDEX "athlete_race_results_goalId_idx" ON "athlete_race_results"("goalId");

-- AddForeignKey
ALTER TABLE "athlete_race_results" ADD CONSTRAINT "athlete_race_results_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_race_results" ADD CONSTRAINT "athlete_race_results_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_race_results" ADD CONSTRAINT "athlete_race_results_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "athlete_race_signups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_race_results" ADD CONSTRAINT "athlete_race_results_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "athlete_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_race_results" ADD CONSTRAINT "athlete_race_results_garminActivityId_fkey" FOREIGN KEY ("garminActivityId") REFERENCES "athlete_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
