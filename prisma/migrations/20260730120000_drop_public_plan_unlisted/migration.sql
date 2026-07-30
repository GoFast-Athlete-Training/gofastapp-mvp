-- Retire UNLISTED: backfill to PUBLIC, then shrink enum to DRAFT | PUBLIC | ARCHIVED.

UPDATE "training_plans"
SET "publicVisibility" = 'PUBLIC'
WHERE "publicVisibility" = 'UNLISTED';

UPDATE "public_training_plans"
SET "visibility" = 'PUBLIC'
WHERE "visibility" = 'UNLISTED';

CREATE TYPE "PublicTrainingPlanVisibility_new" AS ENUM ('DRAFT', 'PUBLIC', 'ARCHIVED');

ALTER TABLE "training_plans"
  ALTER COLUMN "publicVisibility" TYPE "PublicTrainingPlanVisibility_new"
  USING ("publicVisibility"::text::"PublicTrainingPlanVisibility_new");

ALTER TABLE "public_training_plans"
  ALTER COLUMN "visibility" TYPE "PublicTrainingPlanVisibility_new"
  USING ("visibility"::text::"PublicTrainingPlanVisibility_new");

DROP TYPE "PublicTrainingPlanVisibility";

ALTER TYPE "PublicTrainingPlanVisibility_new" RENAME TO "PublicTrainingPlanVisibility";
