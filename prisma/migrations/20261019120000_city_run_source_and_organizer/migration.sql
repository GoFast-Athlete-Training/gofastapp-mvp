-- Shakeout editor: source Instagram URL + organizer string/type (card is runClubId / runBrandId / runStoreId).
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "instagramPostUrl" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "organizerName" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "organizerType" TEXT;
