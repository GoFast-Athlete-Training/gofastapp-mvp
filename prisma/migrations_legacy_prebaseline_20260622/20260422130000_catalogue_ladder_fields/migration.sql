-- Pyramid ladder metadata per catalogue row (within-workout rep structure).

ALTER TABLE "workout_catalogue" ADD COLUMN "isLadderCapable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workout_catalogue" ADD COLUMN "ladderStepMeters" INTEGER;
ALTER TABLE "workout_catalogue" ADD COLUMN "minLadderMeters" INTEGER;
ALTER TABLE "workout_catalogue" ADD COLUMN "maxLadderMeters" INTEGER;
