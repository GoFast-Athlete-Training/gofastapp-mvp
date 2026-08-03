-- Add optional media attachment to athlete tips (owned CMS content).
ALTER TABLE "athlete_tips"
  ADD COLUMN "mediaUrl" TEXT,
  ADD COLUMN "mediaType" TEXT;
