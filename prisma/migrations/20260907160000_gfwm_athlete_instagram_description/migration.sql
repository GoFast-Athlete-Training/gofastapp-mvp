-- Rename GoFast With Me membership junction
ALTER TABLE "gofast_container_memberships" RENAME TO "gfwm_athlete";
ALTER TABLE "gfwm_athlete" RENAME COLUMN "containerAthleteId" TO "athleteId";

-- GWM landing: optional Instagram pitch (handle stays on Athlete.instagram)
ALTER TABLE "gofast_with_me" ADD COLUMN IF NOT EXISTS "instagramDescription" TEXT;
