-- Athlete-hosted city runs: optional club association (not owner runClubId).

CREATE TABLE "city_run_club_associations" (
    "id" TEXT NOT NULL,
    "cityRunId" TEXT NOT NULL,
    "runClubId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "logoUrlSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_run_club_associations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "city_run_club_associations_cityRunId_key" ON "city_run_club_associations"("cityRunId");

CREATE INDEX "city_run_club_associations_runClubId_idx" ON "city_run_club_associations"("runClubId");

ALTER TABLE "city_run_club_associations" ADD CONSTRAINT "city_run_club_associations_cityRunId_fkey" FOREIGN KEY ("cityRunId") REFERENCES "city_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "city_run_club_associations" ADD CONSTRAINT "city_run_club_associations_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "run_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
