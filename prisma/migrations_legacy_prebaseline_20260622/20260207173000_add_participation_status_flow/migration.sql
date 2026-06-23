-- Add participation status enums and fields
-- This replaces the simple checkedIn boolean with a proper status flow

-- Create enums
CREATE TYPE "RSVPStatus" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING');
CREATE TYPE "ParticipationStatus" AS ENUM ('RSVPED', 'CHECKED_IN', 'VERIFIED', 'COMPLETED');

-- Add new fields to city_run_rsvps
ALTER TABLE "city_run_rsvps" 
  ADD COLUMN "rsvpStatus" "RSVPStatus" NOT NULL DEFAULT 'GOING',
  ADD COLUMN "participationStatus" "ParticipationStatus",
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "garminActivityId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Migrate existing status to rsvpStatus
UPDATE "city_run_rsvps" 
SET "rsvpStatus" = CASE 
  WHEN "status" = 'going' THEN 'GOING'::"RSVPStatus"
  WHEN "status" = 'maybe' THEN 'MAYBE'::"RSVPStatus"
  ELSE 'NOT_GOING'::"RSVPStatus"
END;

-- Set participationStatus based on checkedInAt
UPDATE "city_run_rsvps"
SET "participationStatus" = CASE
  WHEN "checkedInAt" IS NOT NULL THEN 'CHECKED_IN'::"ParticipationStatus"
  ELSE 'RSVPED'::"ParticipationStatus"
END
WHERE "rsvpStatus" = 'GOING';

-- Add FK constraint for garminActivityId
ALTER TABLE "city_run_rsvps"
  ADD CONSTRAINT "city_run_rsvps_garminActivityId_fkey"
  FOREIGN KEY ("garminActivityId") 
  REFERENCES "athlete_activities"("id") 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX IF NOT EXISTS "city_run_rsvps_rsvpStatus_idx" ON "city_run_rsvps"("rsvpStatus");
CREATE INDEX IF NOT EXISTS "city_run_rsvps_participationStatus_idx" ON "city_run_rsvps"("participationStatus");
CREATE INDEX IF NOT EXISTS "city_run_rsvps_garminActivityId_idx" ON "city_run_rsvps"("garminActivityId");

-- Note: Keep old "status" and "checkedInAt" columns for backwards compatibility during migration
-- Can drop later after all code is updated
