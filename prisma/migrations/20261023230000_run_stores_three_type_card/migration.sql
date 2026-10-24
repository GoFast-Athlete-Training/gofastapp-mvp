-- Replace five-value StoreType with three-value catalog enum
CREATE TYPE "StoreType_new" AS ENUM ('RUN_STORE', 'FOOD_STORE', 'BIG_BRAND_STORE');

ALTER TABLE "run_stores" ALTER COLUMN "storeType" DROP DEFAULT;
ALTER TABLE "run_stores" ALTER COLUMN "storeType" TYPE "StoreType_new" USING (
  CASE "storeType"::text
    WHEN 'RUN_STORE' THEN 'RUN_STORE'::"StoreType_new"
    WHEN 'COFFEE' THEN 'FOOD_STORE'::"StoreType_new"
    WHEN 'BAGELS' THEN 'FOOD_STORE'::"StoreType_new"
    WHEN 'FOOD' THEN 'FOOD_STORE'::"StoreType_new"
    WHEN 'OTHER' THEN 'RUN_STORE'::"StoreType_new"
    ELSE 'RUN_STORE'::"StoreType_new"
  END
);

DROP TYPE "StoreType";
ALTER TYPE "StoreType_new" RENAME TO "StoreType";
ALTER TABLE "run_stores" ALTER COLUMN "storeType" SET DEFAULT 'RUN_STORE'::"StoreType";

ALTER TABLE "run_stores" ADD COLUMN IF NOT EXISTS "whatItSells" TEXT;
ALTER TABLE "run_stores" ADD COLUMN IF NOT EXISTS "runningTieIn" TEXT;
ALTER TABLE "run_stores" ADD COLUMN IF NOT EXISTS "instagramHandle" TEXT;
ALTER TABLE "run_stores" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "run_stores" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "run_stores" ADD COLUMN IF NOT EXISTS "streetAddress" TEXT;
ALTER TABLE "run_stores" ADD COLUMN IF NOT EXISTS "placeId" TEXT;
ALTER TABLE "run_stores" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "run_stores" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;
ALTER TABLE "run_stores" ADD COLUMN IF NOT EXISTS "zipCode" TEXT;
