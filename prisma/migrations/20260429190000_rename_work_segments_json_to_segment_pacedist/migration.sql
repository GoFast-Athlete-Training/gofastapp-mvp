-- JSON: per-segment pace + distance (mile ladders, block-repeat, interval ladders, etc.)
ALTER TABLE "workout_catalogue" RENAME COLUMN "workSegmentsJson" TO "segmentPaceDist";
