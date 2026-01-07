-- AlterTable: Add foreign key constraint from run_crews.trainingForRace to race_registry.id
-- This enables querying all athletes training for a race across both run crews and training plans

-- First, ensure any invalid data is cleaned up (set to NULL if race doesn't exist)
UPDATE "run_crews" 
SET "trainingForRace" = NULL 
WHERE "trainingForRace" IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM "race_registry" WHERE "race_registry"."id" = "run_crews"."trainingForRace"
  );

-- Add foreign key constraint
ALTER TABLE "run_crews" 
ADD CONSTRAINT "run_crews_trainingForRace_fkey" 
FOREIGN KEY ("trainingForRace") 
REFERENCES "race_registry"("id") 
ON DELETE SET NULL 
ON UPDATE CASCADE;

