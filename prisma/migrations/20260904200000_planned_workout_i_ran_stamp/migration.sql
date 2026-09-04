-- AlterTable
ALTER TABLE "planned_workouts" ADD COLUMN "iRanAt" TIMESTAMP(3),
ADD COLUMN "iRanRole" TEXT,
ADD COLUMN "iRanDeclined" BOOLEAN NOT NULL DEFAULT false;
