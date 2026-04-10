-- Align race_registry with GoFastCompany: distanceLabel + distanceMeters; drop legacy raceType / miles / km.

ALTER TABLE "race_registry" ADD COLUMN "distanceMeters" INTEGER;

UPDATE "race_registry"
SET "distanceMeters" = CAST(ROUND("distanceMiles" * 1609.344) AS INTEGER)
WHERE "distanceMiles" IS NOT NULL;

DROP INDEX IF EXISTS "race_registry_raceType_idx";

ALTER TABLE "race_registry" DROP COLUMN "raceType";
ALTER TABLE "race_registry" DROP COLUMN "distanceMiles";
ALTER TABLE "race_registry" DROP COLUMN "distanceKm";

ALTER TABLE "race_registry" RENAME COLUMN "distanceLabelSnap" TO "distanceLabel";
