-- AlterTable
ALTER TABLE "workouts" ADD COLUMN "skippedAt" TIMESTAMP(3),
ADD COLUMN "skipReason" TEXT;
