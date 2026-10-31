-- AlterTable
ALTER TABLE "race_registry" ADD COLUMN "sourceDiscoveryReady" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "race_registry" ADD COLUMN "sourceRegistrationReady" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "race_registry" ADD COLUMN "sourceTrainingReady" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "race_registry" ADD COLUMN "sourceRaceWeekReady" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "race_registry" ADD COLUMN "lifecycleHorizonOverrides" JSONB;

-- Existing staff-promoted rows stay discoverable until re-validated on next push.
UPDATE "race_registry"
SET
  "sourceDiscoveryReady" = true,
  "sourceRegistrationReady" = true,
  "sourceTrainingReady" = true,
  "sourceRaceWeekReady" = true
WHERE "companyRaceId" IS NOT NULL AND "isActive" = true;
