-- Add id column to run_clubs (UUID primary key)
ALTER TABLE "run_clubs" ADD COLUMN "id" TEXT;

-- Generate UUIDs for existing rows
UPDATE "run_clubs" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;

-- Make id NOT NULL
ALTER TABLE "run_clubs" ALTER COLUMN "id" SET NOT NULL;

-- Drop the old primary key constraint
ALTER TABLE "run_clubs" DROP CONSTRAINT "run_clubs_pkey";

-- Make id the new primary key
ALTER TABLE "run_clubs" ADD PRIMARY KEY ("id");

-- Ensure slug is unique (create unique constraint if it doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS "run_clubs_slug_key" ON "run_clubs"("slug");

-- Add runClubId column to city_runs (nullable for now)
ALTER TABLE "run_crew_runs" ADD COLUMN "runClubId" TEXT;

-- Migrate data: Set runClubId based on matching slug
UPDATE "run_crew_runs" 
SET "runClubId" = (
  SELECT "id" 
  FROM "run_clubs" 
  WHERE "run_clubs"."slug" = "run_crew_runs"."runClubSlug"
)
WHERE "runClubSlug" IS NOT NULL;

-- Create index on runClubId
CREATE INDEX IF NOT EXISTS "run_crew_runs_runClubId_idx" ON "run_crew_runs"("runClubId");

-- Add foreign key constraint
ALTER TABLE "run_crew_runs" ADD CONSTRAINT "run_crew_runs_runClubId_fkey" 
FOREIGN KEY ("runClubId") REFERENCES "run_clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the old runClubSlug column and its index
DROP INDEX IF EXISTS "run_crew_runs_runClubSlug_idx";
ALTER TABLE "run_crew_runs" DROP COLUMN "runClubSlug";
