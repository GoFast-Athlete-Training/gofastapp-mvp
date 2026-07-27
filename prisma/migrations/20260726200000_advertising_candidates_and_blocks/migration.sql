-- CreateEnum
CREATE TYPE "AdvertisingCandidateType" AS ENUM ('ATHLETE');

-- CreateEnum
CREATE TYPE "AdvertisingCandidateStatus" AS ENUM ('ELIGIBLE', 'PAUSED', 'RETIRED');

-- CreateEnum
CREATE TYPE "AdvertisingBlockStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'EXPIRED', 'CANCELED');

-- CreateTable
CREATE TABLE "advertising_candidates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "candidateType" "AdvertisingCandidateType" NOT NULL DEFAULT 'ATHLETE',
    "athleteId" TEXT NOT NULL,
    "status" "AdvertisingCandidateStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "publicSlugSnapshot" TEXT,
    "displayLabel" TEXT,
    "photoUrl" TEXT,
    "eligibleAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertising_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertising_blocks" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "sourcePurchaseId" TEXT NOT NULL,
    "advertiserCompanyId" TEXT NOT NULL,
    "advertiserCompanyName" TEXT,
    "creativeId" TEXT NOT NULL,
    "creativeName" TEXT,
    "brandCampaignCollateralUrl" TEXT,
    "ctaUrl" TEXT,
    "ctaLabel" TEXT,
    "altText" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AdvertisingBlockStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertising_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "advertising_candidates_code_key" ON "advertising_candidates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "advertising_candidates_athleteId_key" ON "advertising_candidates"("athleteId");

-- CreateIndex
CREATE INDEX "advertising_candidates_status_idx" ON "advertising_candidates"("status");

-- CreateIndex
CREATE INDEX "advertising_candidates_candidateType_status_idx" ON "advertising_candidates"("candidateType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "advertising_blocks_sourcePurchaseId_key" ON "advertising_blocks"("sourcePurchaseId");

-- CreateIndex
CREATE INDEX "advertising_blocks_candidateId_status_idx" ON "advertising_blocks"("candidateId", "status");

-- CreateIndex
CREATE INDEX "advertising_blocks_candidateId_startsAt_endsAt_idx" ON "advertising_blocks"("candidateId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "advertising_blocks_status_endsAt_idx" ON "advertising_blocks"("status", "endsAt");

-- AddForeignKey
ALTER TABLE "advertising_candidates" ADD CONSTRAINT "advertising_candidates_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertising_blocks" ADD CONSTRAINT "advertising_blocks_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "advertising_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
