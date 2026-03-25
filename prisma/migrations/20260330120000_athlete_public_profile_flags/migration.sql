-- Public athlete hub (/u/[handle]): opt-in visibility flags
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "profilePublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "showTrainingSummary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "showUpcomingWorkouts" BOOLEAN NOT NULL DEFAULT false;
