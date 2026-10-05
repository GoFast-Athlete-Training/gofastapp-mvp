ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "runBrandWebsiteUrl" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "runBrandInstagramHandle" TEXT;

UPDATE "city_runs" AS cr
SET
  "runBrandWebsiteUrl" = COALESCE(cr."runBrandWebsiteUrl", b."websiteUrl"),
  "runBrandInstagramHandle" = COALESCE(cr."runBrandInstagramHandle", b."instagramHandle")
FROM "brands" AS b
WHERE cr."runBrandId" = b."id"
  AND cr."runBrandId" IS NOT NULL;
