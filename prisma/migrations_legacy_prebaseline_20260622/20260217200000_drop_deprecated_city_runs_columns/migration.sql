-- Drop deprecated columns from city_runs (use runType instead of isRecurring; meetUpStreetAddress instead of meetUpAddress; recurrence* removed)

-- Drop index first (Prisma creates city_runs_isRecurring_idx for @@index([isRecurring]))
DROP INDEX IF EXISTS "city_runs_isRecurring_idx";

ALTER TABLE "city_runs" DROP COLUMN IF EXISTS "isRecurring";
ALTER TABLE "city_runs" DROP COLUMN IF EXISTS "meetUpAddress";
ALTER TABLE "city_runs" DROP COLUMN IF EXISTS "recurrenceRule";
ALTER TABLE "city_runs" DROP COLUMN IF EXISTS "recurrenceEndsOn";
ALTER TABLE "city_runs" DROP COLUMN IF EXISTS "recurrenceNote";
