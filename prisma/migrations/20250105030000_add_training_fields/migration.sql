-- CreateEnum
CREATE TYPE "Purpose" AS ENUM ('Training', 'Fun', 'Social');

-- CreateEnum
CREATE TYPE "TrainingForDistance" AS ENUM ('FiveK', 'TenK', 'HalfMarathon', 'Marathon', 'Ultra');

-- AlterTable: Add training fields to run_crews
ALTER TABLE "run_crews" ADD COLUMN IF NOT EXISTS "purpose" "Purpose"[] DEFAULT ARRAY[]::"Purpose"[],
ADD COLUMN IF NOT EXISTS "trainingFor" TEXT,
ADD COLUMN IF NOT EXISTS "trainingForDistance" "TrainingForDistance"[] DEFAULT ARRAY[]::"TrainingForDistance"[];

-- CreateTable: Junction table for many-to-many relationship between run_crews and race_registry
CREATE TABLE IF NOT EXISTS "run_crew_specific_races" (
    "id" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "raceRegistryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_crew_specific_races_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "run_crew_specific_races_runCrewId_raceRegistryId_key" ON "run_crew_specific_races"("runCrewId", "raceRegistryId");

-- AddForeignKey
ALTER TABLE "run_crew_specific_races" ADD CONSTRAINT "run_crew_specific_races_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_crew_specific_races" ADD CONSTRAINT "run_crew_specific_races_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

