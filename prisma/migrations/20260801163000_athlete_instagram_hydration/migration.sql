-- Instagram connection metadata and public-safe media snapshots for GoFast With Me hydration.
ALTER TABLE "Athlete"
  ADD COLUMN "instagramUserId" TEXT,
  ADD COLUMN "instagramUsername" TEXT,
  ADD COLUMN "instagramAccountType" TEXT,
  ADD COLUMN "instagramAccessTokenEncrypted" TEXT,
  ADD COLUMN "instagramTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "instagramConnectedAt" TIMESTAMP(3),
  ADD COLUMN "instagramLastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Athlete_instagramUserId_key" ON "Athlete"("instagramUserId");

CREATE TABLE "athlete_instagram_media" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "instagramMediaId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "thumbnailUrl" TEXT,
    "permalink" TEXT,
    "caption" TEXT,
    "timestamp" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_instagram_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "athlete_instagram_media_athleteId_instagramMediaId_key"
  ON "athlete_instagram_media"("athleteId", "instagramMediaId");
CREATE INDEX "athlete_instagram_media_athleteId_timestamp_idx"
  ON "athlete_instagram_media"("athleteId", "timestamp");

ALTER TABLE "athlete_instagram_media"
  ADD CONSTRAINT "athlete_instagram_media_athleteId_fkey"
  FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
