-- Club post-run MVP1: manager-published recap on city_runs occurrence
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunNote" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunPhotoUrl" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "postRunPublishedAt" TIMESTAMP(3);
