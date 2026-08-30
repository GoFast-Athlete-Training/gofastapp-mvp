-- Live ad hydration rows spawned from paid sponsor_commitments (receipt vs live ad split).

CREATE TYPE "SponsorshipDeliveryStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED');

CREATE TABLE "sponsorships" (
  "id" TEXT NOT NULL,
  "sponsorCommitmentId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "athleteId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "name" TEXT,
  "brandLogoUrlSnapshot" TEXT,
  "creativeUrl" TEXT,
  "ctaUrl" TEXT,
  "cpmAmount" INTEGER NOT NULL DEFAULT 0,
  "cpmUsed" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "SponsorshipDeliveryStatus" NOT NULL DEFAULT 'SCHEDULED',
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sponsorships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sponsorships_sponsorCommitmentId_key" ON "sponsorships"("sponsorCommitmentId");
CREATE INDEX "sponsorships_athleteId_status_idx" ON "sponsorships"("athleteId", "status");
CREATE INDEX "sponsorships_candidateId_status_idx" ON "sponsorships"("candidateId", "status");
CREATE INDEX "sponsorships_status_endsAt_idx" ON "sponsorships"("status", "endsAt");
CREATE INDEX "sponsorships_brandId_idx" ON "sponsorships"("brandId");

ALTER TABLE "sponsorships"
  ADD CONSTRAINT "sponsorships_sponsorCommitmentId_fkey"
  FOREIGN KEY ("sponsorCommitmentId") REFERENCES "sponsor_commitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sponsorships"
  ADD CONSTRAINT "sponsorships_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "sponsorship_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sponsorships"
  ADD CONSTRAINT "sponsorships_athleteId_fkey"
  FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one hydration row per paid commitment.
INSERT INTO "sponsorships" (
  "id",
  "sponsorCommitmentId",
  "candidateId",
  "athleteId",
  "brandId",
  "name",
  "brandLogoUrlSnapshot",
  "creativeUrl",
  "ctaUrl",
  "cpmAmount",
  "cpmUsed",
  "startsAt",
  "endsAt",
  "status",
  "finishedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  sc."id",
  sc."candidateId",
  cand."athleteId",
  sc."brandId",
  sc."brandNameSnapshot",
  sc."brandLogoUrlSnapshot",
  sc."creativeUrl",
  sc."ctaUrl",
  COALESCE(
    NULLIF((sc."pricingBreakdownJson" ->> 'impressionQty')::int, 0),
    0
  ),
  0,
  sc."startsAt",
  sc."endsAt",
  CASE
    WHEN sc."endsAt" <= NOW() OR sc."status" = 'EXPIRED' THEN 'FINISHED'::"SponsorshipDeliveryStatus"
    WHEN sc."startsAt" <= NOW() AND sc."endsAt" > NOW()
      AND sc."status" IN ('SCHEDULED', 'ACTIVE')
      THEN 'LIVE'::"SponsorshipDeliveryStatus"
    ELSE 'SCHEDULED'::"SponsorshipDeliveryStatus"
  END,
  CASE
    WHEN sc."endsAt" <= NOW() OR sc."status" = 'EXPIRED' THEN sc."endsAt"
    ELSE NULL
  END,
  sc."createdAt",
  NOW()
FROM "sponsor_commitments" sc
JOIN "sponsorship_candidates" cand ON cand."id" = sc."candidateId"
WHERE sc."paymentStatus" = 'PAID'
ON CONFLICT ("sponsorCommitmentId") DO NOTHING;
