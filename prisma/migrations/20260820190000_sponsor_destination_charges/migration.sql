-- CreateEnum
CREATE TYPE "SponsorCommitmentPaymentLifecycle" AS ENUM ('CHECKOUT_PENDING', 'PAID', 'TRANSFERRED', 'REFUNDED', 'FAILED');

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN "stripe_connect_account_id" TEXT,
ADD COLUMN "stripe_connect_charges_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripe_connect_payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripe_connect_details_submitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripe_connect_requirements_json" JSONB,
ADD COLUMN "stripe_connect_onboarded_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sponsor_commitments" ADD COLUMN "stripeBrandCustomerId" TEXT,
ADD COLUMN "stripeConnectAccountId" TEXT,
ADD COLUMN "payoutConfigKey" TEXT,
ADD COLUMN "payoutConfigVersion" INTEGER,
ADD COLUMN "athleteSharePercent" INTEGER,
ADD COLUMN "platformSharePercent" INTEGER;

-- CreateTable
CREATE TABLE "sponsor_commitment_payments" (
    "id" TEXT NOT NULL,
    "sponsorCommitmentId" TEXT NOT NULL,
    "stripeBrandCustomerId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeTransferId" TEXT,
    "stripeApplicationFeeId" TEXT,
    "stripeProcessingFeeCents" INTEGER,
    "stripeConnectAccountId" TEXT,
    "grossAmountCents" INTEGER NOT NULL,
    "athleteShareCents" INTEGER NOT NULL,
    "platformShareCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "payoutConfigKey" TEXT,
    "payoutConfigVersion" INTEGER,
    "athleteSharePercent" INTEGER,
    "platformSharePercent" INTEGER,
    "lifecycle" "SponsorCommitmentPaymentLifecycle" NOT NULL DEFAULT 'CHECKOUT_PENDING',
    "paidAt" TIMESTAMP(3),
    "transferredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsor_commitment_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sponsor_commitment_payments_stripeCheckoutSessionId_key" ON "sponsor_commitment_payments"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "sponsor_commitment_payments_stripePaymentIntentId_key" ON "sponsor_commitment_payments"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "sponsor_commitment_payments_stripeChargeId_key" ON "sponsor_commitment_payments"("stripeChargeId");

-- CreateIndex
CREATE INDEX "sponsor_commitment_payments_sponsorCommitmentId_idx" ON "sponsor_commitment_payments"("sponsorCommitmentId");

-- CreateIndex
CREATE INDEX "sponsor_commitment_payments_lifecycle_idx" ON "sponsor_commitment_payments"("lifecycle");

-- AddForeignKey
ALTER TABLE "sponsor_commitment_payments" ADD CONSTRAINT "sponsor_commitment_payments_sponsorCommitmentId_fkey" FOREIGN KEY ("sponsorCommitmentId") REFERENCES "sponsor_commitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
