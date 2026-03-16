-- CreateTable
CREATE TABLE "race_goal_intent" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "raceId" TEXT,
    "goalTime" TEXT,
    "goalPace5K" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_goal_intent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "race_goal_intent_athleteId_key" ON "race_goal_intent"("athleteId");

-- CreateIndex
CREATE INDEX "race_goal_intent_athleteId_idx" ON "race_goal_intent"("athleteId");

-- CreateIndex
CREATE INDEX "race_goal_intent_raceId_idx" ON "race_goal_intent"("raceId");

-- AddForeignKey
ALTER TABLE "race_goal_intent" ADD CONSTRAINT "race_goal_intent_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_goal_intent" ADD CONSTRAINT "race_goal_intent_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "race_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
