-- GoFast Brand Partnerships: rename advertising inventory → sponsorship_candidates + sponsor_commitments

-- Rename candidate enums/tables
ALTER TYPE "AdvertisingCandidateType" RENAME TO "SponsorshipCandidateType";
ALTER TYPE "AdvertisingCandidateStatus" RENAME TO "SponsorshipCandidateStatus";
ALTER TABLE "advertising_candidates" RENAME TO "sponsorship_candidates";

-- Block status enum becomes commitment status (add DRAFT)
ALTER TYPE "AdvertisingBlockStatus" RENAME TO "SponsorCommitmentStatus";
ALTER TYPE "SponsorCommitmentStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TABLE "advertising_blocks" RENAME TO "sponsor_commitments";

-- Drop legacy purchase/creative columns after snapshot migration
ALTER TABLE "sponsor_commitments" RENAME COLUMN "advertiserCompanyId" TO "brandId";
ALTER TABLE "sponsor_commitments" RENAME COLUMN "advertiserCompanyName" TO "brandNameSnapshot";
ALTER TABLE "sponsor_commitments" RENAME COLUMN "brandCampaignCollateralUrl" TO "creativeUrl";
ALTER TABLE "sponsor_commitments" RENAME COLUMN "amountCents" TO "quotedAmountCents";

ALTER TABLE "sponsor_commitments"
  ADD COLUMN "candidateCodeSnapshot" TEXT,
  ADD COLUMN "brandUserId" TEXT,
  ADD COLUMN "brandLogoUrlSnapshot" TEXT,
  ADD COLUMN "pricingRuleKey" TEXT,
  ADD COLUMN "pricingRuleVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "pricingBreakdownJson" JSONB,
  ADD COLUMN "amountPaidCents" INTEGER,
  ADD COLUMN "athleteShareCents" INTEGER,
  ADD COLUMN "platformShareCents" INTEGER,
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
  ADD COLUMN "stripeCheckoutSessionId" TEXT,
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3);

-- Payment status enum
CREATE TYPE "SponsorCommitmentPaymentStatus" AS ENUM ('UNPAID', 'CHECKOUT_PENDING', 'PAID', 'FAILED', 'REFUNDED');

ALTER TABLE "sponsor_commitments"
  ALTER COLUMN "paymentStatus" DROP DEFAULT;

ALTER TABLE "sponsor_commitments"
  ALTER COLUMN "paymentStatus" TYPE "SponsorCommitmentPaymentStatus"
  USING (
    CASE
      WHEN "paymentStatus" = 'PAID' THEN 'PAID'::"SponsorCommitmentPaymentStatus"
      ELSE 'PAID'::"SponsorCommitmentPaymentStatus"
    END
  );

ALTER TABLE "sponsor_commitments"
  ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID';

-- Backfill migrated rows from legacy block purchase data
UPDATE "sponsor_commitments" sc
SET
  "candidateCodeSnapshot" = cand."code",
  "amountPaidCents" = sc."quotedAmountCents",
  "paidAt" = sc."purchasedAt",
  "pricingRuleKey" = 'legacy-block',
  "paymentStatus" = 'PAID'::"SponsorCommitmentPaymentStatus"
FROM "sponsorship_candidates" cand
WHERE sc."candidateId" = cand."id"
  AND sc."candidateCodeSnapshot" IS NULL;

UPDATE "sponsor_commitments"
SET "candidateCodeSnapshot" = 'UNKNOWN'
WHERE "candidateCodeSnapshot" IS NULL;

UPDATE "sponsor_commitments"
SET "pricingRuleKey" = 'legacy-block'
WHERE "pricingRuleKey" IS NULL;

ALTER TABLE "sponsor_commitments"
  ALTER COLUMN "candidateCodeSnapshot" SET NOT NULL,
  ALTER COLUMN "pricingRuleKey" SET NOT NULL;

ALTER TABLE "sponsor_commitments"
  DROP COLUMN IF EXISTS "sourcePurchaseId",
  DROP COLUMN IF EXISTS "creativeId",
  DROP COLUMN IF EXISTS "creativeName",
  DROP COLUMN IF EXISTS "ctaLabel",
  DROP COLUMN IF EXISTS "altText",
  DROP COLUMN IF EXISTS "purchasedAt";

CREATE UNIQUE INDEX IF NOT EXISTS "sponsor_commitments_stripeCheckoutSessionId_key"
  ON "sponsor_commitments"("stripeCheckoutSessionId");

CREATE UNIQUE INDEX IF NOT EXISTS "sponsor_commitments_stripePaymentIntentId_key"
  ON "sponsor_commitments"("stripePaymentIntentId");

CREATE INDEX IF NOT EXISTS "sponsor_commitments_paymentStatus_idx"
  ON "sponsor_commitments"("paymentStatus");

CREATE INDEX IF NOT EXISTS "sponsor_commitments_brandId_idx"
  ON "sponsor_commitments"("brandId");
