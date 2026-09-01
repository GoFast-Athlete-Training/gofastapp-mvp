-- Add invite-specific host notes on city_runs (workout-backed invites).
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "meetUpNote" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "workoutNarrative" TEXT;
