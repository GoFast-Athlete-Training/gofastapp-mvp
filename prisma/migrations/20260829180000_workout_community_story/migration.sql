-- AlterTable
ALTER TABLE "workouts" ADD COLUMN "publicTitle" TEXT,
ADD COLUMN "howFeltRating" INTEGER,
ADD COLUMN "reflection" TEXT,
ADD COLUMN "workoutPhotoUrl" TEXT,
ADD COLUMN "communityPublishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "workouts_athleteId_communityPublishedAt_idx" ON "workouts"("athleteId", "communityPublishedAt");
