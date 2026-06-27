-- Rename gofastCity → citySlug; add cityId FK and club HQ fields (aligned with GoFastCompany prodpush)

-- run_clubs
ALTER TABLE "run_clubs" RENAME COLUMN "gofastCity" TO "citySlug";

ALTER TABLE "run_clubs" ADD COLUMN IF NOT EXISTS "cityId" TEXT;
ALTER TABLE "run_clubs" ADD COLUMN IF NOT EXISTS "hqPlaceId" TEXT;
ALTER TABLE "run_clubs" ADD COLUMN IF NOT EXISTS "hqFormattedAddress" TEXT;
ALTER TABLE "run_clubs" ADD COLUMN IF NOT EXISTS "hqStreet" TEXT;
ALTER TABLE "run_clubs" ADD COLUMN IF NOT EXISTS "hqZip" TEXT;
ALTER TABLE "run_clubs" ADD COLUMN IF NOT EXISTS "hqLat" DOUBLE PRECISION;
ALTER TABLE "run_clubs" ADD COLUMN IF NOT EXISTS "hqLng" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "run_clubs_cityId_idx" ON "run_clubs"("cityId");
CREATE INDEX IF NOT EXISTS "run_clubs_citySlug_idx" ON "run_clubs"("citySlug");

ALTER TABLE "run_clubs"
  ADD CONSTRAINT "run_clubs_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- run_series
ALTER TABLE "run_series" RENAME COLUMN "gofastCity" TO "citySlug";

ALTER TABLE "run_series" ADD COLUMN IF NOT EXISTS "cityId" TEXT;

ALTER INDEX IF EXISTS "run_series_gofastCity_idx" RENAME TO "run_series_citySlug_idx";

CREATE INDEX IF NOT EXISTS "run_series_cityId_idx" ON "run_series"("cityId");

ALTER TABLE "run_series"
  ADD CONSTRAINT "run_series_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- city_runs
ALTER TABLE "city_runs" RENAME COLUMN "gofastCity" TO "citySlug";

ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "cityId" TEXT;

CREATE INDEX IF NOT EXISTS "city_runs_cityId_idx" ON "city_runs"("cityId");

ALTER TABLE "city_runs"
  ADD CONSTRAINT "city_runs_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- routes
ALTER TABLE "routes" RENAME COLUMN "gofastCity" TO "citySlug";

ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "cityId" TEXT;

ALTER INDEX IF EXISTS "routes_gofastCity_idx" RENAME TO "routes_citySlug_idx";

CREATE INDEX IF NOT EXISTS "routes_cityId_idx" ON "routes"("cityId");

ALTER TABLE "routes"
  ADD CONSTRAINT "routes_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- run_locations
ALTER TABLE "run_locations" RENAME COLUMN "gofastCity" TO "citySlug";

ALTER TABLE "run_locations" ADD COLUMN IF NOT EXISTS "cityId" TEXT;

ALTER INDEX IF EXISTS "run_locations_gofastCity_idx" RENAME TO "run_locations_citySlug_idx";

CREATE INDEX IF NOT EXISTS "run_locations_cityId_idx" ON "run_locations"("cityId");

ALTER TABLE "run_locations"
  ADD CONSTRAINT "run_locations_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
