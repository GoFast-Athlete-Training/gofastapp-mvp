-- Post-run coffee/food stop stamp (Sponsor Manage brand id, no FK).
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandId" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandName" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandLogoUrl" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandWebsiteUrl" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandInstagramHandle" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandStreetAddress" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandFormattedAddress" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandPlaceId" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandLat" DOUBLE PRECISION;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandLng" DOUBLE PRECISION;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandCity" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandState" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandZip" TEXT;

CREATE INDEX IF NOT EXISTS "city_runs_postRunBrandId_idx" ON "city_runs"("postRunBrandId");

ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "streetAddress" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "formattedAddress" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "placeId" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "zipCode" TEXT;

DO $$ BEGIN
  CREATE TYPE "CoffeeFoodKind" AS ENUM ('COFFEE', 'BAGELS', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "coffeeFoodKind" "CoffeeFoodKind";
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "shortDescription" TEXT;

ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunFoodKind" "CoffeeFoodKind";
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunBrandShortDescription" TEXT;

-- AlterEnum
ALTER TYPE "BrandType" ADD VALUE 'COFFEE_FOOD_STORE';
