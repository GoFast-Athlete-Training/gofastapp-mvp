-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN "isCoach" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "AthleteCoachProgramType" AS ENUM ('RACE_TRAINING', 'GENERAL_TRAINING', 'ONE_ON_ONE');

-- CreateTable
CREATE TABLE "athlete_coach_profiles" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "coachExperienceBio" TEXT,
    "trainingFocus" TEXT,
    "trainingMethod" TEXT,
    "companyName" TEXT,
    "discoveryCallUrl" TEXT,
    "city" TEXT,
    "state" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_coach_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_coach_programs" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "philosophy" TEXT,
    "durationWeeks" INTEGER,
    "type" "AthleteCoachProgramType" NOT NULL DEFAULT 'GENERAL_TRAINING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_coach_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_coach_offerings" (
    "id" TEXT NOT NULL,
    "coachProgramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "whatYouGet" TEXT,
    "priceCents" INTEGER,
    "priceDisplay" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_coach_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_coach_profiles_athleteId_key" ON "athlete_coach_profiles"("athleteId");

-- CreateIndex
CREATE INDEX "athlete_coach_programs_athleteId_idx" ON "athlete_coach_programs"("athleteId");

-- CreateIndex
CREATE INDEX "athlete_coach_offerings_coachProgramId_idx" ON "athlete_coach_offerings"("coachProgramId");

-- AddForeignKey
ALTER TABLE "athlete_coach_profiles" ADD CONSTRAINT "athlete_coach_profiles_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_coach_programs" ADD CONSTRAINT "athlete_coach_programs_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_coach_offerings" ADD CONSTRAINT "athlete_coach_offerings_coachProgramId_fkey" FOREIGN KEY ("coachProgramId") REFERENCES "athlete_coach_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
