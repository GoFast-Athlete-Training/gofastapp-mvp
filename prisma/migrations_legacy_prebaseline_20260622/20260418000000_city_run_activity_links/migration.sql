-- CreateTable
CREATE TABLE "city_run_activity_links" (
    "id" TEXT NOT NULL,
    "cityRunId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "activityId" TEXT,
    "linkedManually" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "city_run_activity_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "city_run_activity_links_cityRunId_athleteId_key" ON "city_run_activity_links"("cityRunId", "athleteId");

-- CreateIndex
CREATE INDEX "city_run_activity_links_athleteId_idx" ON "city_run_activity_links"("athleteId");

-- CreateIndex
CREATE INDEX "city_run_activity_links_activityId_idx" ON "city_run_activity_links"("activityId");

-- AddForeignKey
ALTER TABLE "city_run_activity_links" ADD CONSTRAINT "city_run_activity_links_cityRunId_fkey" FOREIGN KEY ("cityRunId") REFERENCES "city_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_run_activity_links" ADD CONSTRAINT "city_run_activity_links_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_run_activity_links" ADD CONSTRAINT "city_run_activity_links_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "athlete_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
