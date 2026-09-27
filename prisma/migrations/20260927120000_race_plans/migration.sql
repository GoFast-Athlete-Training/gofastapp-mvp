-- CreateTable
CREATE TABLE "race_plans" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "athleteRaceId" TEXT NOT NULL,
    "planId" TEXT,
    "raceDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "planJson" JSONB NOT NULL,
    "garminWorkoutId" INTEGER,
    "pushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "race_plans_athleteRaceId_key" ON "race_plans"("athleteRaceId");

-- CreateIndex
CREATE INDEX "race_plans_athleteId_idx" ON "race_plans"("athleteId");

-- CreateIndex
CREATE INDEX "race_plans_planId_idx" ON "race_plans"("planId");

-- AddForeignKey
ALTER TABLE "race_plans" ADD CONSTRAINT "race_plans_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_plans" ADD CONSTRAINT "race_plans_athleteRaceId_fkey" FOREIGN KEY ("athleteRaceId") REFERENCES "athlete_races"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_plans" ADD CONSTRAINT "race_plans_planId_fkey" FOREIGN KEY ("planId") REFERENCES "training_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
