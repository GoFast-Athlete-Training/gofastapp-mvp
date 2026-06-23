-- Replace startTime String with three integer fields (hour, minute, period)
-- Storing as separate Int fields similar to pace fields (easyMilesPace, crushingItPace)
-- startTimeHour: 1-12 (12-hour format)
-- startTimeMinute: 0-59
-- startTimePeriod: 'AM' or 'PM'

ALTER TABLE run_crew_runs 
  ADD COLUMN IF NOT EXISTS "startTimeHour" INTEGER,
  ADD COLUMN IF NOT EXISTS "startTimeMinute" INTEGER,
  ADD COLUMN IF NOT EXISTS "startTimePeriod" TEXT;

-- Drop old startTime column (data will be lost, but this is a new feature)
ALTER TABLE run_crew_runs 
  DROP COLUMN IF EXISTS "startTime";

