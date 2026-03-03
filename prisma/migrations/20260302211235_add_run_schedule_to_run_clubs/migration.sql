-- Add runSchedule to run_clubs (copy of acq_run_clubs.runSchedule from Company — used to build/update series, club-scoped)
ALTER TABLE "run_clubs" ADD COLUMN IF NOT EXISTS "runSchedule" TEXT;
