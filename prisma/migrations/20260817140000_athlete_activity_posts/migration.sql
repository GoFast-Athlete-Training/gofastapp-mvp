-- CreateTable
CREATE TABLE "athlete_activity_posts" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "caption" TEXT,
    "photoUrl" TEXT,
    "showMatchedWorkout" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_activity_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_activity_posts_activityId_key" ON "athlete_activity_posts"("activityId");

-- CreateIndex
CREATE INDEX "athlete_activity_posts_athleteId_publishedAt_idx" ON "athlete_activity_posts"("athleteId", "publishedAt");

-- AddForeignKey
ALTER TABLE "athlete_activity_posts" ADD CONSTRAINT "athlete_activity_posts_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_activity_posts" ADD CONSTRAINT "athlete_activity_posts_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "athlete_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
