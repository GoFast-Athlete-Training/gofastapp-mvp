-- Remove bidirectional ID mapping field: companyRunClubId
-- The original design was genius: Company ID = Product app ID!
-- This field was unnecessary complexity that we added during debugging.
-- Reverting to the original simple design.

-- Drop index first
DROP INDEX IF EXISTS "run_clubs_companyRunClubId_idx";

-- Drop column
ALTER TABLE "run_clubs" DROP COLUMN IF EXISTS "companyRunClubId";
