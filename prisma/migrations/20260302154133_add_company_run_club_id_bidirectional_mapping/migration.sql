-- Add bidirectional ID mapping field: companyRunClubId
-- This stores the Company's acq_run_clubs.id for easy cross-database lookups

ALTER TABLE "run_clubs" ADD COLUMN "companyRunClubId" TEXT;

-- Create index for efficient lookups
CREATE INDEX "run_clubs_companyRunClubId_idx" ON "run_clubs"("companyRunClubId");
