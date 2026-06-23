-- DropTable
-- This migration removes the deprecated run_crew_managers table.
-- Role information has been migrated to run_crew_memberships.role.
-- The RunCrewManager model has been removed from the Prisma schema.

DROP TABLE IF EXISTS "run_crew_managers";

