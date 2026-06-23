-- Replace paceMin and paceMax with easyMilesPace and crushingItPace
-- Note: paceAverage was removed - only using easyMilesPace and crushingItPace
-- Storing as INT (seconds per mile) for better filtering and matching
-- Examples: 480 = "8:00", 570 = "9:30", 420 = "7:00"

ALTER TABLE run_crews 
  ADD COLUMN IF NOT EXISTS "easyMilesPace" INTEGER,
  ADD COLUMN IF NOT EXISTS "crushingItPace" INTEGER;

-- Drop old columns (data will be lost, but this is a new feature)
ALTER TABLE run_crews 
  DROP COLUMN IF EXISTS "paceMin",
  DROP COLUMN IF EXISTS "paceMax";
