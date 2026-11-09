-- Universal charity catalog + athlete claim join.

CREATE TABLE "charities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "charityWebsiteUrl" TEXT,
    "city" TEXT,
    "state" TEXT,
    "address" TEXT,
    "description" TEXT,
    "mission" TEXT,
    "charitySupports" TEXT,
    "charityLogo" TEXT,
    "notes" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "charities_name_idx" ON "charities"("name");

CREATE TABLE "athlete_charities" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "charityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "athlete_charities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "athlete_charities_athleteId_charityId_key" ON "athlete_charities"("athleteId", "charityId");

CREATE INDEX "athlete_charities_athleteId_idx" ON "athlete_charities"("athleteId");

CREATE INDEX "athlete_charities_charityId_idx" ON "athlete_charities"("charityId");

ALTER TABLE "athlete_charities" ADD CONSTRAINT "athlete_charities_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "athlete_charities" ADD CONSTRAINT "athlete_charities_charityId_fkey" FOREIGN KEY ("charityId") REFERENCES "charities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
