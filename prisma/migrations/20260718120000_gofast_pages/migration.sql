-- GoFast Page entity: athlete-scoped landing CMS with slug snapshot
CREATE TABLE "gofast_pages" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "gofastSlugSnapshot" TEXT NOT NULL,
    "welcomeOpener" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gofast_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "athlete_tips" (
    "id" TEXT NOT NULL,
    "gofastPageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_tips_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gofast_page_routes" (
    "gofastPageId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "gofast_page_routes_pkey" PRIMARY KEY ("gofastPageId","routeId")
);

CREATE UNIQUE INDEX "gofast_pages_athleteId_key" ON "gofast_pages"("athleteId");
CREATE UNIQUE INDEX "gofast_pages_gofastSlugSnapshot_key" ON "gofast_pages"("gofastSlugSnapshot");
CREATE INDEX "athlete_tips_gofastPageId_sortOrder_idx" ON "athlete_tips"("gofastPageId", "sortOrder");
CREATE INDEX "gofast_page_routes_gofastPageId_sortOrder_idx" ON "gofast_page_routes"("gofastPageId", "sortOrder");

ALTER TABLE "gofast_pages" ADD CONSTRAINT "gofast_pages_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "athlete_tips" ADD CONSTRAINT "athlete_tips_gofastPageId_fkey" FOREIGN KEY ("gofastPageId") REFERENCES "gofast_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gofast_page_routes" ADD CONSTRAINT "gofast_page_routes_gofastPageId_fkey" FOREIGN KEY ("gofastPageId") REFERENCES "gofast_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gofast_page_routes" ADD CONSTRAINT "gofast_page_routes_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill pages for athletes with handles
INSERT INTO "gofast_pages" ("id", "athleteId", "gofastSlugSnapshot", "updatedAt")
SELECT
    gen_random_uuid()::text,
    a."id",
    LOWER(TRIM(a."gofastHandle")),
    NOW()
FROM "Athlete" a
WHERE a."gofastHandle" IS NOT NULL
  AND TRIM(a."gofastHandle") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "gofast_pages" gp WHERE gp."athleteId" = a."id"
  );
