-- Add rsvpPhotoUrls to city_run_rsvps (photos attendee posted for this run)
ALTER TABLE "city_run_rsvps" ADD COLUMN IF NOT EXISTS "rsvpPhotoUrls" JSONB;

-- CreateTable ambassador_payouts (FK-based: period start = latest payout processedAt)
CREATE TABLE IF NOT EXISTS "ambassador_payouts" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "companyPayoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambassador_payouts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ambassador_payouts_athleteId_idx" ON "ambassador_payouts"("athleteId");
CREATE INDEX IF NOT EXISTS "ambassador_payouts_processedAt_idx" ON "ambassador_payouts"("processedAt");

ALTER TABLE "ambassador_payouts" DROP CONSTRAINT IF EXISTS "ambassador_payouts_athleteId_fkey";
ALTER TABLE "ambassador_payouts" ADD CONSTRAINT "ambassador_payouts_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable ambassador_credits
CREATE TABLE IF NOT EXISTS "ambassador_credits" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "cityRunRsvpId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambassador_credits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ambassador_credits_cityRunRsvpId_key" ON "ambassador_credits"("cityRunRsvpId");
CREATE INDEX IF NOT EXISTS "ambassador_credits_athleteId_idx" ON "ambassador_credits"("athleteId");
CREATE INDEX IF NOT EXISTS "ambassador_credits_createdAt_idx" ON "ambassador_credits"("createdAt");

ALTER TABLE "ambassador_credits" DROP CONSTRAINT IF EXISTS "ambassador_credits_athleteId_fkey";
ALTER TABLE "ambassador_credits" ADD CONSTRAINT "ambassador_credits_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ambassador_credits" DROP CONSTRAINT IF EXISTS "ambassador_credits_cityRunRsvpId_fkey";
ALTER TABLE "ambassador_credits" ADD CONSTRAINT "ambassador_credits_cityRunRsvpId_fkey" FOREIGN KEY ("cityRunRsvpId") REFERENCES "city_run_rsvps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
