-- Refactor announcement archiving to use archivedAt timestamp only
-- Remove isArchived boolean, use archivedAt: null = active, archivedAt set = archived

-- First, ensure archivedAt column exists
ALTER TABLE "run_crew_announcements" 
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP;

-- Migrate existing data: if isArchived is true, set archivedAt to updatedAt (or createdAt if updatedAt is null)
UPDATE "run_crew_announcements"
SET "archivedAt" = COALESCE("updatedAt", "createdAt")
WHERE "isArchived" = true AND "archivedAt" IS NULL;

-- Drop the isArchived column
ALTER TABLE "run_crew_announcements" 
DROP COLUMN IF EXISTS "isArchived";

