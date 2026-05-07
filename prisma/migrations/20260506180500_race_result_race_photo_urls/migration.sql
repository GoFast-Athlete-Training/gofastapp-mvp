-- AlterTable
ALTER TABLE "athlete_race_results" ADD COLUMN "racePhotoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
