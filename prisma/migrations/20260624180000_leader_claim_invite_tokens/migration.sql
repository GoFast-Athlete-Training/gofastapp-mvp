-- AlterTable
ALTER TABLE "run_club_leader_claims" ADD COLUMN "managerAssignmentId" TEXT;
ALTER TABLE "run_club_leader_claims" ADD COLUMN "inviteTokenHash" TEXT;
ALTER TABLE "run_club_leader_claims" ADD COLUMN "inviteExpiresAt" TIMESTAMP(3);
ALTER TABLE "run_club_leader_claims" ADD COLUMN "lastInviteSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "run_club_leader_claims_inviteTokenHash_key" ON "run_club_leader_claims"("inviteTokenHash");
