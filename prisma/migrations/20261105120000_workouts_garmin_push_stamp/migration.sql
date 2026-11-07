-- AlterTable
ALTER TABLE "workouts" ADD COLUMN "workoutPushed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workouts" ADD COLUMN "workoutEditedAfterPush" BOOLEAN NOT NULL DEFAULT false;
