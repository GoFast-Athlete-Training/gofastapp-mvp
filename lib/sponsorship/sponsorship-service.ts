import { prisma } from "@/lib/prisma";
import { extractCpmAmountFromBreakdown } from "@/lib/sponsorship/pricing-breakdown";
import {
  SponsorCommitmentPaymentStatus,
  SponsorCommitmentStatus,
  SponsorshipDeliveryStatus,
  type sponsor_commitments,
  type sponsorship_candidates,
  type sponsorships,
} from "@prisma/client";

type CommitmentWithCandidate = sponsor_commitments & {
  candidate: Pick<sponsorship_candidates, "id" | "athleteId">;
};

export function deriveSponsorshipDeliveryStatus(
  startsAt: Date,
  endsAt: Date,
  now = new Date(),
): SponsorshipDeliveryStatus {
  if (now >= endsAt) return SponsorshipDeliveryStatus.FINISHED;
  if (now < startsAt) return SponsorshipDeliveryStatus.SCHEDULED;
  return SponsorshipDeliveryStatus.LIVE;
}

function buildSponsorshipDataFromCommitment(
  commitment: CommitmentWithCandidate,
  now = new Date(),
): Omit<sponsorships, "id" | "createdAt" | "updatedAt"> {
  const status = deriveSponsorshipDeliveryStatus(commitment.startsAt, commitment.endsAt, now);

  return {
    sponsorCommitmentId: commitment.id,
    candidateId: commitment.candidateId,
    athleteId: commitment.candidate.athleteId,
    brandId: commitment.brandId,
    name: commitment.brandNameSnapshot,
    brandLogoUrlSnapshot: commitment.brandLogoUrlSnapshot,
    creativeUrl: commitment.creativeUrl,
    ctaUrl: commitment.ctaUrl,
    cpmAmount: extractCpmAmountFromBreakdown(commitment.pricingBreakdownJson),
    cpmUsed: 0,
    startsAt: commitment.startsAt,
    endsAt: commitment.endsAt,
    status,
    finishedAt: status === SponsorshipDeliveryStatus.FINISHED ? commitment.endsAt : null,
  };
}

export async function spawnSponsorshipFromPaidCommitment(
  commitment: CommitmentWithCandidate,
  now = new Date(),
): Promise<sponsorships> {
  const existing = await prisma.sponsorships.findUnique({
    where: { sponsorCommitmentId: commitment.id },
  });
  if (existing) return existing;

  return prisma.sponsorships.create({
    data: buildSponsorshipDataFromCommitment(commitment, now),
  });
}

export async function finishSponsorshipForCommitment(
  sponsorCommitmentId: string,
  finishedAt = new Date(),
  reason: "window" | "refund" | "cpm_max" = "window",
): Promise<number> {
  const result = await prisma.sponsorships.updateMany({
    where: {
      sponsorCommitmentId,
      status: {
        in: [SponsorshipDeliveryStatus.SCHEDULED, SponsorshipDeliveryStatus.LIVE],
      },
    },
    data: {
      status: SponsorshipDeliveryStatus.FINISHED,
      finishedAt,
      updatedAt: finishedAt,
    },
  });

  if (result.count > 0 && reason !== "window") {
    console.info("[sponsorship-service] finished sponsorship", {
      sponsorCommitmentId,
      reason,
    });
  }

  return result.count;
}

export async function activateStartedSponsorships(now = new Date()): Promise<number> {
  const result = await prisma.sponsorships.updateMany({
    where: {
      status: SponsorshipDeliveryStatus.SCHEDULED,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    data: {
      status: SponsorshipDeliveryStatus.LIVE,
      updatedAt: now,
    },
  });
  return result.count;
}

export async function finishEndedSponsorships(now = new Date()): Promise<number> {
  const ended = await prisma.sponsorships.findMany({
    where: {
      status: {
        in: [SponsorshipDeliveryStatus.SCHEDULED, SponsorshipDeliveryStatus.LIVE],
      },
      endsAt: { lte: now },
    },
    select: { sponsorCommitmentId: true },
  });

  if (ended.length === 0) return 0;

  const result = await prisma.sponsorships.updateMany({
    where: {
      status: {
        in: [SponsorshipDeliveryStatus.SCHEDULED, SponsorshipDeliveryStatus.LIVE],
      },
      endsAt: { lte: now },
    },
    data: {
      status: SponsorshipDeliveryStatus.FINISHED,
      finishedAt: now,
      updatedAt: now,
    },
  });

  return result.count;
}

export type ActiveSponsorshipSnapshot = {
  sponsorshipId: string;
  commitmentId: string;
  brandId: string;
  brandNameSnapshot: string | null;
  brandLogoUrlSnapshot: string | null;
  creativeUrl: string | null;
  ctaUrl: string | null;
  startsAt: string;
  endsAt: string;
  cpmAmount: number;
  cpmUsed: number;
};

export async function getActiveSponsorshipSnapshotForAthlete(
  athleteId: string,
  now = new Date(),
): Promise<ActiveSponsorshipSnapshot | null> {
  const row = await prisma.sponsorships.findFirst({
    where: {
      athleteId,
      status: SponsorshipDeliveryStatus.LIVE,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    orderBy: [{ startsAt: "desc" }],
  });

  if (!row || (!row.creativeUrl?.trim() && !row.ctaUrl?.trim())) {
    return null;
  }

  return {
    sponsorshipId: row.id,
    commitmentId: row.sponsorCommitmentId,
    brandId: row.brandId,
    brandNameSnapshot: row.name,
    brandLogoUrlSnapshot: row.brandLogoUrlSnapshot,
    creativeUrl: row.creativeUrl,
    ctaUrl: row.ctaUrl,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    cpmAmount: row.cpmAmount,
    cpmUsed: row.cpmUsed,
  };
}

export type AthleteSponsorshipHistoryRow = {
  sponsorshipId: string;
  commitmentId: string;
  brandId: string;
  brandNameSnapshot: string | null;
  brandLogoUrlSnapshot: string | null;
  creativeUrl: string | null;
  ctaUrl: string | null;
  startsAt: string;
  endsAt: string;
  deliveryStatus: SponsorshipDeliveryStatus;
  cpmAmount: number;
  cpmUsed: number;
  amountPaidCents: number | null;
  athleteShareCents: number | null;
  paidAt: string | null;
};

export async function listAthleteSponsorshipHistory(
  athleteId: string,
): Promise<AthleteSponsorshipHistoryRow[]> {
  const rows = await prisma.sponsorships.findMany({
    where: {
      athleteId,
      commitment: {
        paymentStatus: SponsorCommitmentPaymentStatus.PAID,
      },
    },
    include: {
      commitment: {
        select: {
          id: true,
          amountPaidCents: true,
          athleteShareCents: true,
          paidAt: true,
        },
      },
    },
    orderBy: [{ commitment: { paidAt: "desc" } }, { createdAt: "desc" }],
  });

  return rows.map((row) => ({
    sponsorshipId: row.id,
    commitmentId: row.sponsorCommitmentId,
    brandId: row.brandId,
    brandNameSnapshot: row.name,
    brandLogoUrlSnapshot: row.brandLogoUrlSnapshot,
    creativeUrl: row.creativeUrl,
    ctaUrl: row.ctaUrl,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    deliveryStatus: row.status,
    cpmAmount: row.cpmAmount,
    cpmUsed: row.cpmUsed,
    amountPaidCents: row.commitment.amountPaidCents,
    athleteShareCents: row.commitment.athleteShareCents,
    paidAt: row.commitment.paidAt?.toISOString() ?? null,
  }));
}

/** Receipt bookkeeping — commitment status mirrors payment window for brand views. */
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
