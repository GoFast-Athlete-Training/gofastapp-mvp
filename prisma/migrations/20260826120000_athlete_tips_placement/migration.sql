-- Tip placement: Landing page vs Community feed
ALTER TABLE "athlete_tips" ADD COLUMN "showOnLanding" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "athlete_tips" ADD COLUMN "showOnFeed" BOOLEAN NOT NULL DEFAULT true;

UPDATE "athlete_tips"
SET "showOnLanding" = false, "showOnFeed" = false
WHERE "isPublished" = false;
