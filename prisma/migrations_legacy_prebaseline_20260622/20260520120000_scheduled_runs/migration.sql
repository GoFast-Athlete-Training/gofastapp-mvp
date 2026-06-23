-- CreateTable
CREATE TABLE "scheduled_runs" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "workoutId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTimeLabel" TEXT,
    "title" TEXT NOT NULL,
    "estimatedDistanceMi" DOUBLE PRECISION,
    "isTrack" BOOLEAN NOT NULL DEFAULT false,
    "stravaRouteUrl" TEXT,
    "meetupLocation" TEXT,
    "routeDescription" TEXT,
    "shareSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_runs_shareSlug_key" ON "scheduled_runs"("shareSlug");

-- CreateIndex
CREATE INDEX "scheduled_runs_athleteId_idx" ON "scheduled_runs"("athleteId");

-- CreateIndex
CREATE INDEX "scheduled_runs_athleteId_date_idx" ON "scheduled_runs"("athleteId", "date");

-- CreateIndex
CREATE INDEX "scheduled_runs_workoutId_idx" ON "scheduled_runs"("workoutId");

-- AddForeignKey
ALTER TABLE "scheduled_runs" ADD CONSTRAINT "scheduled_runs_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_runs" ADD CONSTRAINT "scheduled_runs_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
