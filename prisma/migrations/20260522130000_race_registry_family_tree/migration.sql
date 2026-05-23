-- Family tree: per-distance race_registry rows linked to primary via parentRaceId;
-- stable upsert key from GoFastCompany race_registrations.id.

ALTER TABLE "race_registry" ADD COLUMN IF NOT EXISTS "companyRegistrationId" TEXT;
ALTER TABLE "race_registry" ADD COLUMN IF NOT EXISTS "parentRaceId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "race_registry_companyRegistrationId_key"
  ON "race_registry"("companyRegistrationId");

CREATE INDEX IF NOT EXISTS "race_registry_parentRaceId_idx"
  ON "race_registry"("parentRaceId");

CREATE INDEX IF NOT EXISTS "race_registry_companyRegistrationId_idx"
  ON "race_registry"("companyRegistrationId");

ALTER TABLE "race_registry"
  ADD CONSTRAINT "race_registry_parentRaceId_fkey"
  FOREIGN KEY ("parentRaceId") REFERENCES "race_registry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
