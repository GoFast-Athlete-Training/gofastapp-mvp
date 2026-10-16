-- Generated city run card links on athlete link trees.

ALTER TYPE "AthleteLinkTreeLinkKind" ADD VALUE IF NOT EXISTS 'CITY_RUN';

ALTER TABLE "athlete_link_tree_links" ADD COLUMN "cityRunId" TEXT;

ALTER TABLE "athlete_link_tree_links"
  ADD CONSTRAINT "athlete_link_tree_links_cityRunId_fkey"
  FOREIGN KEY ("cityRunId") REFERENCES "city_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "athlete_link_tree_links_treeId_cityRunId_key"
  ON "athlete_link_tree_links" ("treeId", "cityRunId")
  WHERE "cityRunId" IS NOT NULL;

CREATE INDEX "athlete_link_tree_links_cityRunId_idx" ON "athlete_link_tree_links"("cityRunId");
