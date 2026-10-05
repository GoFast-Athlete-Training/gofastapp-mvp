-- City run brand display stamp; runBrandId is Sponsor Manage id without brands FK.
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "runBrandName" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "runBrandLogoUrl" TEXT;

UPDATE "city_runs" AS cr
SET
  "runBrandName" = COALESCE(cr."runBrandName", b."name"),
  "runBrandLogoUrl" = COALESCE(cr."runBrandLogoUrl", b."logoUrl")
FROM "brands" AS b
WHERE cr."runBrandId" = b."id"
  AND cr."runBrandId" IS NOT NULL;

ALTER TABLE "city_runs" DROP CONSTRAINT IF EXISTS "city_runs_runBrandId_fkey";
