-- AlterTable
ALTER TABLE "workout_catalogue" ADD COLUMN "trainingIntent" TEXT[] DEFAULT ARRAY[]::TEXT[];
