-- Staff-promoted registry rows pushed after source_readiness migration kept default false.
UPDATE "race_registry"
SET
  "sourceDiscoveryReady" = true,
  "sourceRegistrationReady" = true,
  "sourceTrainingReady" = true,
  "sourceRaceWeekReady" = true
WHERE "companyRaceId" IS NOT NULL
  AND "isActive" = true
  AND "isCancelled" = false
  AND "sourceDiscoveryReady" = false;
