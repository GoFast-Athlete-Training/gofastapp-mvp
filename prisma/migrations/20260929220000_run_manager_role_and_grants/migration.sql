-- AlterEnum
ALTER TYPE "AthleteRole" ADD VALUE 'RUN_MANAGER';

-- CreateTable
CREATE TABLE "run_manager_grants" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unclaimed',
    "athleteId" TEXT,
    "managerAssignmentId" TEXT,
    "assignedByStaffId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_manager_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "run_manager_grants_email_status_idx" ON "run_manager_grants"("email", "status");

-- CreateIndex
CREATE INDEX "run_manager_grants_athleteId_idx" ON "run_manager_grants"("athleteId");

-- AddForeignKey
ALTER TABLE "run_manager_grants" ADD CONSTRAINT "run_manager_grants_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
