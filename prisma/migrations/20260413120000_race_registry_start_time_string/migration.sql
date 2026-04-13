-- race_registry.startTime: store wall-clock label from GoFastCompany (e.g. "10:00 AM"), not UTC DateTime.
-- Clear values that were incorrectly stored as UTC instants; repopulate via prodpush.
UPDATE "race_registry" SET "startTime" = NULL WHERE "startTime" IS NOT NULL;

ALTER TABLE "race_registry" ALTER COLUMN "startTime" TYPE TEXT USING (NULL::text);
