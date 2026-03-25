-- Revert opt-in flags; public /u/[handle] is keyed off gofastHandle only
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "profilePublic";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "showTrainingSummary";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "showUpcomingWorkouts";
