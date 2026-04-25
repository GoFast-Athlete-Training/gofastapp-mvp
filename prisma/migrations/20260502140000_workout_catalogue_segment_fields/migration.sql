-- Rename columns to segment-mirrored names
ALTER TABLE "workout_catalogue" RENAME COLUMN "reps" TO "workBaseReps";
ALTER TABLE "workout_catalogue" RENAME COLUMN "repDistanceMeters" TO "workBaseRepMeters";
ALTER TABLE "workout_catalogue" RENAME COLUMN "repPaceOffsetSecPerMile" TO "workBasePaceOffsetSecPerMile";
ALTER TABLE "workout_catalogue" RENAME COLUMN "isLadderCapable" TO "isLadder";
ALTER TABLE "workout_catalogue" RENAME COLUMN "overallPaceOffsetSecPerMile" TO "workPaceOffsetSecPerMile";

-- New fields
ALTER TABLE "workout_catalogue" ADD COLUMN "description" TEXT;
ALTER TABLE "workout_catalogue" ADD COLUMN "warmupPaceOffsetSecPerMile" INTEGER;
ALTER TABLE "workout_catalogue" ADD COLUMN "cooldownPaceOffsetSecPerMile" INTEGER;
ALTER TABLE "workout_catalogue" ADD COLUMN "workBaseMiles" DOUBLE PRECISION;
ALTER TABLE "workout_catalogue" ADD COLUMN "isMP" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workout_catalogue" ADD COLUMN "mpTotalMiles" DOUBLE PRECISION;
ALTER TABLE "workout_catalogue" ADD COLUMN "mpPaceOffsetSecPerMile" INTEGER;

UPDATE "workout_catalogue" SET "isMP" = true WHERE "isLongRunQuality" = true;
