-- myRunRoutes CMS: per-athlete curation of shared catalog routes
CREATE TABLE "athlete_run_routes" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_run_routes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "athlete_run_routes_athleteId_routeId_key" ON "athlete_run_routes"("athleteId", "routeId");
CREATE INDEX "athlete_run_routes_athleteId_sortOrder_idx" ON "athlete_run_routes"("athleteId", "sortOrder");
CREATE INDEX "athlete_run_routes_athleteId_isPublished_idx" ON "athlete_run_routes"("athleteId", "isPublished");

ALTER TABLE "athlete_run_routes" ADD CONSTRAINT "athlete_run_routes_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "athlete_run_routes" ADD CONSTRAINT "athlete_run_routes_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
