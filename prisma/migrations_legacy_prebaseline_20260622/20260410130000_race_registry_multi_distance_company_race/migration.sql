-- Allow multiple race_registry rows per company race (one per distance); add summaryPhrase.
DROP INDEX IF EXISTS "race_registry_companyRaceId_key";

CREATE INDEX IF NOT EXISTS "race_registry_companyRaceId_idx" ON "race_registry"("companyRaceId");

ALTER TABLE "race_registry" ADD COLUMN IF NOT EXISTS "summaryPhrase" TEXT;
