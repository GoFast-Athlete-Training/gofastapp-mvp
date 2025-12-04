-- AlterTable: Add raceId column if it doesn't exist
ALTER TABLE "TrainingPlan" ADD COLUMN IF NOT EXISTS "raceId" TEXT;

-- AddForeignKey: Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TrainingPlan_raceId_fkey'
  ) THEN
    ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_raceId_fkey" 
    FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
