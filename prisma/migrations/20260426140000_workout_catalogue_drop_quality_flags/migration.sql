-- Drop legacy plan-gen boolean flags; paceAnchor + workoutType are source of truth.
ALTER TABLE "workout_catalogue" DROP COLUMN IF EXISTS "isQuality";
ALTER TABLE "workout_catalogue" DROP COLUMN IF EXISTS "isLongRunQuality";
ALTER TABLE "workout_catalogue" DROP COLUMN IF EXISTS "isMP";
