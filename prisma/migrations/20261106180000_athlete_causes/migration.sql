-- Athlete-owned causes (charities / fundraising links) and optional link-tree pointer.

CREATE TABLE "athlete_causes" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "logoUrl" TEXT,
    "note" TEXT,
    "raceRegistryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_causes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "athlete_causes_athleteId_websiteUrl_key" ON "athlete_causes"("athleteId", "websiteUrl");

CREATE INDEX "athlete_causes_athleteId_idx" ON "athlete_causes"("athleteId");

ALTER TABLE "athlete_causes" ADD CONSTRAINT "athlete_causes_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "athlete_link_tree_links" ADD COLUMN "athleteCauseId" TEXT;

CREATE INDEX "athlete_link_tree_links_athleteCauseId_idx" ON "athlete_link_tree_links"("athleteCauseId");

ALTER TABLE "athlete_link_tree_links" ADD CONSTRAINT "athlete_link_tree_links_athleteCauseId_fkey" FOREIGN KEY ("athleteCauseId") REFERENCES "athlete_causes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
