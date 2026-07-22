-- Athlete-scoped durable public tips (CMS content — not container feed posts).
CREATE TABLE "athlete_tips" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_tips_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "athlete_tips_athleteId_sortOrder_idx" ON "athlete_tips"("athleteId", "sortOrder");
CREATE INDEX "athlete_tips_athleteId_isPublished_idx" ON "athlete_tips"("athleteId", "isPublished");

ALTER TABLE "athlete_tips" ADD CONSTRAINT "athlete_tips_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
