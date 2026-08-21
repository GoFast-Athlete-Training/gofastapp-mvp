import { prisma } from "@/lib/prisma";
import { sendAppNotification } from "@/lib/app-notifications/send";
import {
  AthletePayoutSetupRequiredError,
  requireAthletePayoutDestination,
} from "@/lib/sponsorship/athlete-stripe-connect-service";
import {
  attachCheckoutSessionToPayment,
  createCheckoutPendingPayment,
  finalizeCommitmentPayment,
} from "@/lib/sponsorship/commitment-payment-service";
import {
  getCandidateForPurchase,
  validateCandidatePurchaseIdentity,
} from "@/lib/sponsorship/candidate-service";
import {
  SponsorCommitmentPaymentStatus,
  SponsorCommitmentStatus,
  type sponsor_commitments,
  type sponsorship_candidates,
} from "@prisma/client";

export type CreateCheckoutPendingInput = {
  candidateId: string;
  candidateCode: string;
  brandId: string;
  brandUserId: string;
  brandNameSnapshot?: string | null;
  brandLogoUrlSnapshot?: string | null;
  creativeUrl?: string | null;
  ctaUrl?: string | null;
  startsAt: Date;
  endsAt: Date;
  pricingRuleKey: string;
  pricingRuleVersion: number;
  pricingBreakdownJson?: unknown;
  quotedAmountCents: number;
  currency?: string;
  athleteShareCents?: number | null;
  platformShareCents?: number | null;
  stripeBrandCustomerId?: string | null;
  stripeConnectAccountId?: string | null;
  payoutConfigKey?: string | null;
  payoutConfigVersion?: number | null;
  athleteSharePercent?: number | null;
  platformSharePercent?: number | null;
  stripeCheckoutSessionId?: string | null;
};

export type FinalizePaidInput = {
  commitmentId: string;
  amountPaidCents: number;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeTransferId?: string | null;
  stripeApplicationFeeId?: string | null;
  stripeProcessingFeeCents?: number | null;
  paidAt?: Date;
};

export type ActiveCommitmentSnapshot = {
  commitmentId: string;
  brandNameSnapshot: string | null;
  brandLogoUrlSnapshot: string | null;
  creativeUrl: string | null;
  ctaUrl: string | null;
  startsAt: string;
  endsAt: string;
};

export type AthleteSponsorshipHistoryRow = {
  commitmentId: string;
  brandNameSnapshot: string | null;
  brandLogoUrlSnapshot: string | null;
  creativeUrl: string | null;
  ctaUrl: string | null;
  startsAt: string;
  endsAt: string;
  status: SponsorCommitmentStatus;
  paymentStatus: SponsorCommitmentPaymentStatus;
  amountPaidCents: number | null;
  paidAt: string | null;
};

function deriveRuntimeStatus(
  startsAt: Date,
  endsAt: Date,
  now = new Date(),
): SponsorCommitmentStatus {
  if (now < startsAt) return SponsorCommitmentStatus.SCHEDULED;
  if (now >= endsAt) return SponsorCommitmentStatus.EXPIRED;
  return SponsorCommitmentStatus.ACTIVE;
}

async function findOverlappingPaidCommitment(
  candidateId: string,
  startsAt: Date,
  endsAt: Date,
  excludeCommitmentId?: string,
): Promise<sponsor_commitments | null> {
  return prisma.sponsor_commitments.findFirst({
    where: {
      id: excludeCommitmentId ? { not: excludeCommitmentId } : undefined,
      candidateId,
      paymentStatus: SponsorCommitmentPaymentStatus.PAID,
      status: {
        in: [
          SponsorCommitmentStatus.SCHEDULED,
          SponsorCommitmentStatus.ACTIVE,
        ],
      },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
}

export async function createCheckoutPendingCommitment(
  input: CreateCheckoutPendingInput,
): Promise<sponsor_commitments> {
  const candidate = await getCandidateForPurchase(input.candidateId, input.candidateCode);
  if (!candidate) {
    throw new Error("Candidate not found, not eligible, or ID/code mismatch");
  }

  const overlap = await findOverlappingPaidCommitment(
    candidate.id,
    input.startsAt,
    input.endsAt,
  );
  if (overlap) {
    throw new Error("Candidate already has an overlapping paid commitment");
  }

  const athleteConnectAccountId = await requireAthletePayoutDestination(candidate.athleteId);

  if (
    input.stripeConnectAccountId?.trim() &&
    input.stripeConnectAccountId.trim() !== athleteConnectAccountId
  ) {
    throw new Error("Athlete payout destination mismatch");
  }

  if (!input.payoutConfigKey?.trim() || typeof input.payoutConfigVersion !== "number") {
    throw new Error("Payout config snapshot is required");
  }
  if (
    typeof input.athleteSharePercent !== "number" ||
    typeof input.platformSharePercent !== "number" ||
    input.athleteSharePercent + input.platformSharePercent !== 100
  ) {
    throw new Error("Invalid payout split snapshot");
  }

  const commitment = await prisma.sponsor_commitments.create({
    data: {
      candidateId: candidate.id,
      candidateCodeSnapshot: candidate.code,
      brandId: input.brandId,
      brandUserId: input.brandUserId,
      brandNameSnapshot: input.brandNameSnapshot ?? null,
      brandLogoUrlSnapshot: input.brandLogoUrlSnapshot ?? null,
      creativeUrl: input.creativeUrl ?? null,
      ctaUrl: input.ctaUrl ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      pricingRuleKey: input.pricingRuleKey,
      pricingRuleVersion: input.pricingRuleVersion,
      pricingBreakdownJson: input.pricingBreakdownJson ?? undefined,
      quotedAmountCents: input.quotedAmountCents,
      currency: input.currency ?? "usd",
      athleteShareCents: input.athleteShareCents ?? null,
      platformShareCents: input.platformShareCents ?? null,
      stripeBrandCustomerId: input.stripeBrandCustomerId ?? null,
      stripeConnectAccountId: athleteConnectAccountId,
      payoutConfigKey: input.payoutConfigKey.trim(),
      payoutConfigVersion: input.payoutConfigVersion,
      athleteSharePercent: input.athleteSharePercent,
      platformSharePercent: input.platformSharePercent,
      paymentStatus: SponsorCommitmentPaymentStatus.CHECKOUT_PENDING,
      status: SponsorCommitmentStatus.DRAFT,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    },
  });

  await createCheckoutPendingPayment({
    sponsorCommitmentId: commitment.id,
    stripeBrandCustomerId: input.stripeBrandCustomerId ?? null,
    stripeConnectAccountId: athleteConnectAccountId,
    grossAmountCents: input.quotedAmountCents,
    athleteShareCents: input.athleteShareCents ?? 0,
    platformShareCents: input.platformShareCents ?? 0,
    currency: input.currency ?? "usd",
    payoutConfigKey: input.payoutConfigKey.trim(),
    payoutConfigVersion: input.payoutConfigVersion,
    athleteSharePercent: input.athleteSharePercent,
    platformSharePercent: input.platformSharePercent,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
  });

  return commitment;
}

export async function attachCheckoutSessionToCommitment(
  commitmentId: string,
  stripeCheckoutSessionId: string,
): Promise<sponsor_commitments> {
  await attachCheckoutSessionToPayment(commitmentId, stripeCheckoutSessionId);

  return prisma.sponsor_commitments.update({
    where: { id: commitmentId },
    data: {
      stripeCheckoutSessionId,
      paymentStatus: SponsorCommitmentPaymentStatus.CHECKOUT_PENDING,
      updatedAt: new Date(),
    },
  });
}

export type FinalizePaidResult = {
  commitment: sponsor_commitments;
  newlyActivated: boolean;
};

export async function finalizePaidCommitment(
  input: FinalizePaidInput,
): Promise<FinalizePaidResult> {
  const existing = await prisma.sponsor_commitments.findUnique({
    where: { id: input.commitmentId },
    include: { candidate: true },
  });

  if (!existing) {
    throw new Error("Commitment not found");
  }

  if (existing.paymentStatus === SponsorCommitmentPaymentStatus.PAID) {
    return { commitment: existing, newlyActivated: false };
  }

  if (
    !validateCandidatePurchaseIdentity(
      existing.candidate,
      existing.candidateId,
      existing.candidateCodeSnapshot,
    )
  ) {
    throw new Error("Candidate no longer eligible for this commitment");
  }

  const paidAt = input.paidAt ?? new Date();
  const runtimeStatus = deriveRuntimeStatus(existing.startsAt, existing.endsAt, paidAt);

  const updated = await prisma.sponsor_commitments.update({
    where: { id: existing.id },
    data: {
      paymentStatus: SponsorCommitmentPaymentStatus.PAID,
      status: runtimeStatus,
      amountPaidCents: input.amountPaidCents,
      paidAt,
      stripeCheckoutSessionId:
        input.stripeCheckoutSessionId ?? existing.stripeCheckoutSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId ?? existing.stripePaymentIntentId,
      updatedAt: new Date(),
    },
    include: { candidate: true },
  });

  if (input.stripeCheckoutSessionId) {
    await finalizeCommitmentPayment({
      sponsorCommitmentId: existing.id,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      stripeChargeId: input.stripeChargeId ?? null,
      stripeTransferId: input.stripeTransferId ?? null,
      stripeApplicationFeeId: input.stripeApplicationFeeId ?? null,
      stripeProcessingFeeCents: input.stripeProcessingFeeCents ?? null,
      paidAt,
      transferredAt: input.stripeTransferId ? paidAt : null,
    });
  }

  await notifyAthleteOfNewSponsorship(updated);

  return { commitment: updated, newlyActivated: true };
}

async function notifyAthleteOfNewSponsorship(
  commitment: sponsor_commitments & { candidate: { athleteId: string } },
): Promise<void> {
  const brandName = commitment.brandNameSnapshot?.trim() || "A brand";
  try {
    await sendAppNotification({
      athleteId: commitment.candidate.athleteId,
      templateKey: "sponsorship.received",
      objectType: "sponsor_commitment",
      objectId: commitment.id,
      payload: {
        brandName,
        brandLogoUrl: commitment.brandLogoUrlSnapshot,
        commitmentId: commitment.id,
      },
      facts: {
        brandName,
        startsAt: commitment.startsAt.toISOString(),
        endsAt: commitment.endsAt.toISOString(),
      },
    });
  } catch (error) {
    console.warn("[commitment-service] athlete notification failed", error);
  }
}

export type CommitmentWithCandidatePublic = {
  id: string;
  brandId: string;
  brandUserId: string | null;
  paymentStatus: SponsorCommitmentPaymentStatus;
  status: SponsorCommitmentStatus;
  amountPaidCents: number | null;
  quotedAmountCents: number;
  paidAt: string | null;
  startsAt: string;
  endsAt: string;
  candidateId: string;
  candidateCode: string;
  athleteId: string;
  displayLabel: string | null;
  photoUrl: string | null;
  publicSlug: string | null;
};

function serializeCommitmentWithCandidate(
  commitment: sponsor_commitments & {
    candidate: Pick<
      sponsorship_candidates,
      "id" | "code" | "athleteId" | "displayLabel" | "photoUrl" | "publicSlugSnapshot"
    >;
  },
): CommitmentWithCandidatePublic {
  return {
    id: commitment.id,
    brandId: commitment.brandId,
    brandUserId: commitment.brandUserId,
    paymentStatus: commitment.paymentStatus,
    status: commitment.status,
    amountPaidCents: commitment.amountPaidCents,
    quotedAmountCents: commitment.quotedAmountCents,
    paidAt: commitment.paidAt?.toISOString() ?? null,
    startsAt: commitment.startsAt.toISOString(),
    endsAt: commitment.endsAt.toISOString(),
    candidateId: commitment.candidate.id,
    candidateCode: commitment.candidate.code,
    athleteId: commitment.candidate.athleteId,
    displayLabel: commitment.candidate.displayLabel,
    photoUrl: commitment.candidate.photoUrl,
    publicSlug: commitment.candidate.publicSlugSnapshot,
  };
}

export async function getCommitmentById(
  commitmentId: string,
): Promise<sponsor_commitments | null> {
  return prisma.sponsor_commitments.findUnique({ where: { id: commitmentId } });
}

export async function getCommitmentByIdWithCandidate(
  commitmentId: string,
): Promise<CommitmentWithCandidatePublic | null> {
  const commitment = await prisma.sponsor_commitments.findUnique({
    where: { id: commitmentId },
    include: {
      candidate: {
        select: {
          id: true,
          code: true,
          athleteId: true,
          displayLabel: true,
          photoUrl: true,
          publicSlugSnapshot: true,
        },
      },
    },
  });
  if (!commitment) return null;
  return serializeCommitmentWithCandidate(commitment);
}

export async function listCommitmentsForBrand(input: {
  brandId: string;
  brandUserId: string;
}): Promise<CommitmentWithCandidatePublic[]> {
  const rows = await prisma.sponsor_commitments.findMany({
    where: {
      brandId: input.brandId,
      brandUserId: input.brandUserId,
    },
    include: {
      candidate: {
        select: {
          id: true,
          code: true,
          athleteId: true,
          displayLabel: true,
          photoUrl: true,
          publicSlugSnapshot: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });
  return rows.map(serializeCommitmentWithCandidate);
}

export async function getActiveCommitmentSnapshotForAthlete(
  athleteId: string,
  now = new Date(),
): Promise<ActiveCommitmentSnapshot | null> {
  const candidate = await prisma.sponsorship_candidates.findFirst({
    where: { athleteId },
    select: { id: true },
  });
  if (!candidate) return null;

  const commitment = await prisma.sponsor_commitments.findFirst({
    where: {
      candidateId: candidate.id,
      paymentStatus: SponsorCommitmentPaymentStatus.PAID,
      startsAt: { lte: now },
      endsAt: { gt: now },
      status: {
        in: [SponsorCommitmentStatus.SCHEDULED, SponsorCommitmentStatus.ACTIVE],
      },
    },
    orderBy: [{ startsAt: "desc" }],
  });

  if (!commitment || (!commitment.creativeUrl?.trim() && !commitment.ctaUrl?.trim())) {
    return null;
  }

  return {
    commitmentId: commitment.id,
    brandNameSnapshot: commitment.brandNameSnapshot,
    brandLogoUrlSnapshot: commitment.brandLogoUrlSnapshot,
    creativeUrl: commitment.creativeUrl,
    ctaUrl: commitment.ctaUrl,
    startsAt: commitment.startsAt.toISOString(),
    endsAt: commitment.endsAt.toISOString(),
  };
}

export async function listAthleteSponsorshipHistory(
  athleteId: string,
): Promise<AthleteSponsorshipHistoryRow[]> {
  const candidate = await prisma.sponsorship_candidates.findFirst({
    where: { athleteId },
    select: { id: true },
  });
  if (!candidate) return [];

  const rows = await prisma.sponsor_commitments.findMany({
    where: {
      candidateId: candidate.id,
      paymentStatus: SponsorCommitmentPaymentStatus.PAID,
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((row) => ({
    commitmentId: row.id,
    brandNameSnapshot: row.brandNameSnapshot,
    brandLogoUrlSnapshot: row.brandLogoUrlSnapshot,
    creativeUrl: row.creativeUrl,
    ctaUrl: row.ctaUrl,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    paymentStatus: row.paymentStatus,
    amountPaidCents: row.amountPaidCents,
    paidAt: row.paidAt?.toISOString() ?? null,
  }));
}

export async function expireEndedSponsorCommitments(now = new Date()): Promise<number> {
  const result = await prisma.sponsor_commitments.updateMany({
    where: {
      endsAt: { lte: now },
      paymentStatus: SponsorCommitmentPaymentStatus.PAID,
      status: {
        in: [SponsorCommitmentStatus.SCHEDULED, SponsorCommitmentStatus.ACTIVE],
      },
    },
    data: {
      status: SponsorCommitmentStatus.EXPIRED,
      updatedAt: now,
    },
  });
  return result.count;
}

export async function activateStartedSponsorCommitments(now = new Date()): Promise<number> {
  const result = await prisma.sponsor_commitments.updateMany({
    where: {
      startsAt: { lte: now },
      endsAt: { gt: now },
      paymentStatus: SponsorCommitmentPaymentStatus.PAID,
      status: SponsorCommitmentStatus.SCHEDULED,
    },
    data: {
      status: SponsorCommitmentStatus.ACTIVE,
      updatedAt: now,
    },
  });
  return result.count;
}

export { deriveRuntimeStatus, AthletePayoutSetupRequiredError };
