-- Remove isArchived boolean from run_crews, use archivedAt timestamp only
-- archivedAt: null = active, archivedAt set = archived

-- Migrate existing data: if isArchived is true but archivedAt is null, set archivedAt to updatedAt (or createdAt)
UPDATE "run_crews"
SET "archivedAt" = COALESCE("updatedAt", "createdAt")
WHERE "isArchived" = true AND "archivedAt" IS NULL;

-- Drop the isArchived column
ALTER TABLE "run_crews" 
DROP COLUMN IF EXISTS "isArchived";

