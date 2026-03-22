-- Reusable routes + optional links from city_runs (join-my-workout + saved route reference)

CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stravaUrl" TEXT,
    "distanceMiles" DOUBLE PRECISION,
    "stravaMapUrl" TEXT,
    "mapImageUrl" TEXT,
    "routePhotos" JSONB,
    "routeNeighborhood" TEXT,
    "runType" TEXT,
    "gofastCity" TEXT,
    "createdByAthleteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "routes_gofastCity_idx" ON "routes"("gofastCity");
CREATE INDEX "routes_name_idx" ON "routes"("name");

ALTER TABLE "routes" ADD CONSTRAINT "routes_createdByAthleteId_fkey"
    FOREIGN KEY ("createdByAthleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "city_runs" ADD COLUMN "routeId" TEXT;
ALTER TABLE "city_runs" ADD COLUMN "workoutId" TEXT;

CREATE INDEX "city_runs_routeId_idx" ON "city_runs"("routeId");
CREATE INDEX "city_runs_workoutId_idx" ON "city_runs"("workoutId");

ALTER TABLE "city_runs" ADD CONSTRAINT "city_runs_routeId_fkey"
    FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "city_runs" ADD CONSTRAINT "city_runs_workoutId_fkey"
    FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
