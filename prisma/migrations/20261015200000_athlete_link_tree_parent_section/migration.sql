-- AlterTable
ALTER TABLE "athlete_link_tree_links" ADD COLUMN "parentSectionId" TEXT;

-- CreateIndex
CREATE INDEX "athlete_link_tree_links_parentSectionId_idx" ON "athlete_link_tree_links"("parentSectionId");

-- AddForeignKey
ALTER TABLE "athlete_link_tree_links" ADD CONSTRAINT "athlete_link_tree_links_parentSectionId_fkey" FOREIGN KEY ("parentSectionId") REFERENCES "athlete_link_tree_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill ATHLETE_RACE rows: parent = nearest preceding section in same tree
UPDATE "athlete_link_tree_links" AS child
SET "parentSectionId" = (
  SELECT s.id
  FROM "athlete_link_tree_links" s
  WHERE s."treeId" = child."treeId"
    AND s."isSection" = true
    AND (s."sortOrder" < child."sortOrder" OR (s."sortOrder" = child."sortOrder" AND s.id < child.id))
  ORDER BY s."sortOrder" DESC, s.id DESC
  LIMIT 1
)
WHERE child.kind = 'ATHLETE_RACE'
  AND child."isSection" = false
  AND child."parentSectionId" IS NULL;
