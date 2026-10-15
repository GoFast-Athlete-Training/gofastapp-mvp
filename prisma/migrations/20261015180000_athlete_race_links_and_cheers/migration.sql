-- Athlete-scoped race cards on gofastlinks + public cheer JSON on claims.

ALTER TABLE "athlete_races" ADD COLUMN "myCheers" JSONB NOT NULL DEFAULT '[]';

ALTER TYPE "AthleteLinkTreeLinkKind" ADD VALUE IF NOT EXISTS 'ATHLETE_RACE';

ALTER TABLE "athlete_link_tree_links" ADD COLUMN "athleteRaceId" TEXT;

ALTER TABLE "athlete_link_tree_links"
  ADD CONSTRAINT "athlete_link_tree_links_athleteRaceId_fkey"
  FOREIGN KEY ("athleteRaceId") REFERENCES "athlete_races"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "athlete_link_tree_links_treeId_athleteRaceId_key"
  ON "athlete_link_tree_links" ("treeId", "athleteRaceId")
  WHERE "athleteRaceId" IS NOT NULL;
