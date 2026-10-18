-- CreateTable
CREATE TABLE "race_hub_profiles" (
    "raceId" TEXT NOT NULL,
    "welcomeText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_hub_profiles_pkey" PRIMARY KEY ("raceId")
);

-- AddForeignKey
ALTER TABLE "race_hub_profiles" ADD CONSTRAINT "race_hub_profiles_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remap legacy race hub chatter topics to three channels
UPDATE "race_messages" SET "topic" = 'my-goal-time' WHERE "topic" = 'pace-goals';
UPDATE "race_messages" SET "topic" = 'questions' WHERE "topic" = 'ask-the-community';
UPDATE "race_messages" SET "topic" = 'general' WHERE "topic" IN (
  'getting-there',
  'logistics',
  'social-meetups',
  'tips'
);
