-- Mark existing rows as legacy PACE encoding (sec/mile × km/mi, mis-stored as "sec/km").
-- Run `npm run db:migrate-pace-targets` once after deploy to normalize JSON and set version 2.

ALTER TABLE "workout_segments" ADD COLUMN "paceTargetEncodingVersion" INTEGER;

UPDATE "workout_segments" SET "paceTargetEncodingVersion" = 1 WHERE "paceTargetEncodingVersion" IS NULL;

ALTER TABLE "workout_segments" ALTER COLUMN "paceTargetEncodingVersion" SET NOT NULL;
ALTER TABLE "workout_segments" ALTER COLUMN "paceTargetEncodingVersion" SET DEFAULT 2;
