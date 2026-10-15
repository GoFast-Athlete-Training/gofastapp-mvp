-- CreateEnum
CREATE TYPE "AthleteLinkTreeLinkKind" AS ENUM ('CUSTOM', 'RACES');

-- AlterTable
ALTER TABLE "athlete_link_tree_links" ADD COLUMN "kind" "AthleteLinkTreeLinkKind" NOT NULL DEFAULT 'CUSTOM';
