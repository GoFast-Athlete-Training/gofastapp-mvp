-- Add allRunsDescription to run_clubs (overall description for this club's run series — drives run_series.description)
ALTER TABLE "run_clubs" ADD COLUMN IF NOT EXISTS "allRunsDescription" TEXT;
