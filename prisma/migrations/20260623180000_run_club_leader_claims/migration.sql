-- CreateTable
CREATE TABLE "run_club_leader_claims" (
    "id" TEXT NOT NULL,
    "runClubId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "membershipRole" TEXT NOT NULL DEFAULT 'admin',
    "status" TEXT NOT NULL DEFAULT 'unclaimed',
    "acqClubLeaderId" TEXT,
    "acqRunClubId" TEXT,
    "claimedByAthleteId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_club_leader_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "run_club_leader_claims_email_status_idx" ON "run_club_leader_claims"("email", "status");

-- CreateIndex
CREATE INDEX "run_club_leader_claims_runClubId_idx" ON "run_club_leader_claims"("runClubId");

-- CreateIndex
CREATE UNIQUE INDEX "run_club_leader_claims_runClubId_email_key" ON "run_club_leader_claims"("runClubId", "email");

-- AddForeignKey
ALTER TABLE "run_club_leader_claims" ADD CONSTRAINT "run_club_leader_claims_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "run_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_club_leader_claims" ADD CONSTRAINT "run_club_leader_claims_claimedByAthleteId_fkey" FOREIGN KEY ("claimedByAthleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
