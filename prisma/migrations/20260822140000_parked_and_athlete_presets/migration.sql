-- Rename replaced-plan lifecycle to athlete-facing PARKED.
ALTER TYPE "TrainingPlanLifecycle" RENAME VALUE 'OLD_PLAN_UNUSED' TO 'PARKED';

CREATE TYPE "AthletePresetFitnessPhase" AS ENUM ('PEAK', 'BASE');

CREATE TABLE "athlete_presets" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objectiveOfPlan" TEXT,
    "cycleLen" INTEGER NOT NULL DEFAULT 4,
    "minWeeklyMiles" INTEGER NOT NULL DEFAULT 40,
    "maxWeeklyMiles" INTEGER,
    "baseMiles" DOUBLE PRECISION NOT NULL,
    "peakMiles" DOUBLE PRECISION NOT NULL,
    "taperMiles" DOUBLE PRECISION NOT NULL,
    "tempoIdealDow" INTEGER NOT NULL DEFAULT 2,
    "intervalIdealDow" INTEGER NOT NULL DEFAULT 4,
    "longRunDefaultDow" INTEGER NOT NULL DEFAULT 6,
    "trainingHistory" TEXT,
    "fitnessPhase" "AthletePresetFitnessPhase" NOT NULL DEFAULT 'BASE',
    "ageYearsSnapshot" INTEGER,
    "genderSnapshot" TEXT,
    "sourcePresetId" TEXT,
    "promotedPresetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_presets_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "training_plans" ADD COLUMN "athletePresetId" TEXT;

CREATE INDEX "athlete_presets_athleteId_idx" ON "athlete_presets"("athleteId");
CREATE INDEX "athlete_presets_sourcePresetId_idx" ON "athlete_presets"("sourcePresetId");
CREATE INDEX "training_plans_athletePresetId_idx" ON "training_plans"("athletePresetId");

ALTER TABLE "athlete_presets" ADD CONSTRAINT "athlete_presets_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "athlete_presets" ADD CONSTRAINT "athlete_presets_sourcePresetId_fkey" FOREIGN KEY ("sourcePresetId") REFERENCES "training_plan_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "athlete_presets" ADD CONSTRAINT "athlete_presets_promotedPresetId_fkey" FOREIGN KEY ("promotedPresetId") REFERENCES "training_plan_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_athletePresetId_fkey" FOREIGN KEY ("athletePresetId") REFERENCES "athlete_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
