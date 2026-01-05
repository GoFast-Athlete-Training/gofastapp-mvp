-- AlterTable: Add isArchived and archivedAt to run_crew_announcements
ALTER TABLE "run_crew_announcements" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP;

