-- CreateTable
CREATE TABLE "athlete_link_trees" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "internalDescription" TEXT,
    "publicLabel" TEXT,
    "publicDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_link_trees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_link_tree_links" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicLabel" TEXT,
    "internalDescription" TEXT,
    "description" TEXT,
    "linkLogoUrl" TEXT,
    "emoji" TEXT,
    "url" TEXT,
    "isSection" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_link_tree_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_link_trees_athleteId_key" ON "athlete_link_trees"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_link_trees_slug_key" ON "athlete_link_trees"("slug");

-- CreateIndex
CREATE INDEX "athlete_link_tree_links_treeId_idx" ON "athlete_link_tree_links"("treeId");

-- CreateIndex
CREATE INDEX "athlete_link_tree_links_treeId_sortOrder_idx" ON "athlete_link_tree_links"("treeId", "sortOrder");

-- AddForeignKey
ALTER TABLE "athlete_link_trees" ADD CONSTRAINT "athlete_link_trees_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_link_tree_links" ADD CONSTRAINT "athlete_link_tree_links_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "athlete_link_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
