-- AlterTable - Multiple source inputs for traceability and AI processing
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "stravaUrl" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "stravaText" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "webUrl" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "webText" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "igPostText" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "igPostGraphic" TEXT;
