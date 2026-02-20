-- Verify and add all source tracking fields if missing
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "stravaUrl" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "stravaText" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "webUrl" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "webText" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "igPostText" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "igPostGraphic" TEXT;

-- Verify and add run detail fields if missing
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunActivity" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "routeNeighborhood" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "runType" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "workoutDescription" TEXT;
