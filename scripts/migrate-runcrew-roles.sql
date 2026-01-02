-- Migration Script: Backfill RunCrewMembership.role from RunCrewManager
-- Run this AFTER schema migration adds the role field
-- 
-- Step 1: Set all existing memberships to 'member' (default)
UPDATE run_crew_memberships
SET role = 'member'::run_crew_role
WHERE role IS NULL;

-- Step 2: Copy roles from run_crew_managers into run_crew_memberships.role
-- Maps 'admin' -> 'admin', 'manager' -> 'manager', others -> 'member'
UPDATE run_crew_memberships m
SET role = CASE 
  WHEN rm.role = 'admin' THEN 'admin'::run_crew_role
  WHEN rm.role = 'manager' THEN 'manager'::run_crew_role
  ELSE 'member'::run_crew_role
END
FROM run_crew_managers rm
WHERE m."runCrewId" = rm."runCrewId"
  AND m."athleteId" = rm."athleteId";

-- Step 3: Verify no NULL roles remain
-- This should return 0 rows
SELECT COUNT(*) as null_roles
FROM run_crew_memberships
WHERE role IS NULL;

