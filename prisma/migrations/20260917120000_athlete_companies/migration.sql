CREATE TABLE "athlete_companies" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_companies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "athlete_companies_athleteId_key" ON "athlete_companies"("athleteId");
CREATE UNIQUE INDEX "athlete_companies_slug_key" ON "athlete_companies"("slug");

ALTER TABLE "athlete_companies" ADD CONSTRAINT "athlete_companies_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
