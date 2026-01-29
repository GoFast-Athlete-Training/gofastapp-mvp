-- Delete test run that can't be hydrated
-- Run ID: cmksp4v2y0001l404vv17aec5
-- This run was created before FK migration and can't be properly hydrated

DELETE FROM "run_crew_runs" 
WHERE "id" = 'cmksp4v2y0001l404vv17aec5';
