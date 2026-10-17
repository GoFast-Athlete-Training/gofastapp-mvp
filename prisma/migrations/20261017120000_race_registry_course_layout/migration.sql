ALTER TABLE "race_registry" ADD COLUMN IF NOT EXISTS "startLineLabel" TEXT;
ALTER TABLE "race_registry" ADD COLUMN IF NOT EXISTS "finishLineLabel" TEXT;
ALTER TABLE "race_registry" ADD COLUMN IF NOT EXISTS "isLoop" BOOLEAN;
