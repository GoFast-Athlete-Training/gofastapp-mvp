-- Replace paceMin and paceMax with paceAverage, easyMilesPace, and crushingItPace

ALTER TABLE run_crews 
  ADD COLUMN IF NOT EXISTS "paceAverage" TEXT,
  ADD COLUMN IF NOT EXISTS "easyMilesPace" TEXT,
  ADD COLUMN IF NOT EXISTS "crushingItPace" TEXT;

-- Drop old columns (data will be lost, but this is a new feature)
ALTER TABLE run_crews 
  DROP COLUMN IF EXISTS "paceMin",
  DROP COLUMN IF EXISTS "paceMax";
