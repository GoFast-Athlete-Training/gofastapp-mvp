-- Goal time + imprinted pace on plans; MP block fields on workout catalogue.

ALTER TABLE "training_plans" ADD COLUMN "goalRaceTime" TEXT;
ALTER TABLE "training_plans" ADD COLUMN "goalRacePace" TEXT;

ALTER TABLE "workout_catalogue" ADD COLUMN "paceAnchor" TEXT NOT NULL DEFAULT 'currentBuildup';
ALTER TABLE "workout_catalogue" ADD COLUMN "mpFraction" DOUBLE PRECISION;
ALTER TABLE "workout_catalogue" ADD COLUMN "mpBlockPosition" TEXT;
ALTER TABLE "workout_catalogue" ADD COLUMN "mpBlockProgression" TEXT NOT NULL DEFAULT 'flat';
