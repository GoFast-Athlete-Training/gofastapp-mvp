import { prisma } from "@/lib/prisma";
import {
  AdvertisingBlockStatus,
  AdvertisingCandidateStatus,
  type advertising_blocks,
} from "@prisma/client";
import { getCandidateForPurchase } from "@/lib/advertising/candidate-service";

export type BlockCreativeSnapshot = {
  creativeId: string;
  creativeName?: string | null;
  brandCampaignCollateralUrl?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  altText?: string | null;
};

export type CreateBlockInput = {
  sourcePurchaseId: string;
  candidateId: string;
  candidateCode: string;
  advertiserCompanyId: string;
  advertiserCompanyName?: string | null;
  amountCents: number;
  currency?: string;
  purchasedAt?: Date;
  startsAt: Date;
  endsAt: Date;
  creative: BlockCreativeSnapshot;
};

export type ActiveBlockSnapshot = {
  blockId: string;
  sourcePurchaseId: string;
  creativeName: string | null;
  brandCampaignCollateralUrl: string | null;
  ctaUrl: string | null;
  ctaLabel: string | null;
  altText: string | null;
  startsAt: string;
  endsAt: string;
};

function deriveBlockStatus(startsAt: Date, endsAt: Date, now = new Date()): AdvertisingBlockStatus {
  if (now < startsAt) return AdvertisingBlockStatus.SCHEDULED;
  if (now >= endsAt) return AdvertisingBlockStatus.EXPIRED;
  return AdvertisingBlockStatus.ACTIVE;
}

async function findOverlappingActiveBlock(
  candidateId: string,
  startsAt: Date,
  endsAt: Date,
  excludeSourcePurchaseId?: string,
): Promise<advertising_blocks | null> {
  return prisma.advertising_blocks.findFirst({
    where: {
      candidateId,
      sourcePurchaseId: excludeSourcePurchaseId ? { not: excludeSourcePurchaseId } : undefined,
      status: { in: [AdvertisingBlockStatus.SCHEDULED, AdvertisingBlockStatus.ACTIVE] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
}

export async function createAdvertisingBlockFromPurchase(
  input: CreateBlockInput,
): Promise<advertising_blocks> {
  const existing = await prisma.advertising_blocks.findUnique({
    where: { sourcePurchaseId: input.sourcePurchaseId },
  });
  if (existing) return existing;

  const candidate = await getCandidateForPurchase(input.candidateId, input.candidateCode);
  if (!candidate) {
    throw new Error("Candidate not found, not eligible, or ID/code mismatch");
  }

  const overlap = await findOverlappingActiveBlock(
    candidate.id,
    input.startsAt,
    input.endsAt,
  );
  if (overlap) {
    throw new Error("Candidate already has an overlapping active or scheduled block");
  }

  const status = deriveBlockStatus(input.startsAt, input.endsAt, input.purchasedAt ?? new Date());

  return prisma.advertising_blocks.create({
    data: {
      candidateId: candidate.id,
      sourcePurchaseId: input.sourcePurchaseId,
      advertiserCompanyId: input.advertiserCompanyId,
      advertiserCompanyName: input.advertiserCompanyName ?? null,
      creativeId: input.creative.creativeId,
      creativeName: input.creative.creativeName ?? null,
      brandCampaignCollateralUrl: input.creative.brandCampaignCollateralUrl ?? null,
      ctaUrl: input.creative.ctaUrl ?? null,
      ctaLabel: input.creative.ctaLabel ?? null,
      altText: input.creative.altText ?? null,
      amountCents: input.amountCents,
      currency: input.currency ?? "usd",
      purchasedAt: input.purchasedAt ?? new Date(),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status,
    },
  });
}

export async function getActiveBlockSnapshotForAthlete(
  athleteId: string,
  now = new Date(),
): Promise<ActiveBlockSnapshot | null> {
  const candidate = await prisma.advertising_candidates.findFirst({
    where: {
      athleteId,
      status: AdvertisingCandidateStatus.ELIGIBLE,
    },
    select: { id: true },
  });
  if (!candidate) return null;

  const block = await prisma.advertising_blocks.findFirst({
    where: {
      candidateId: candidate.id,
      startsAt: { lte: now },
      endsAt: { gt: now },
      status: { in: [AdvertisingBlockStatus.SCHEDULED, AdvertisingBlockStatus.ACTIVE] },
    },
    orderBy: [{ startsAt: "desc" }],
  });

  if (!block) return null;

  return {
    blockId: block.id,
    sourcePurchaseId: block.sourcePurchaseId,
    creativeName: block.creativeName,
    brandCampaignCollateralUrl: block.brandCampaignCollateralUrl,
    ctaUrl: block.ctaUrl,
    ctaLabel: block.ctaLabel,
    altText: block.altText,
    startsAt: block.startsAt.toISOString(),
    endsAt: block.endsAt.toISOString(),
  };
}

export async function expireEndedAdvertisingBlocks(now = new Date()): Promise<number> {
  const result = await prisma.advertising_blocks.updateMany({
    where: {
      endsAt: { lte: now },
      status: { in: [AdvertisingBlockStatus.SCHEDULED, AdvertisingBlockStatus.ACTIVE] },
    },
    data: {
      status: AdvertisingBlockStatus.EXPIRED,
      updatedAt: now,
    },
  });
  return result.count;
}

export async function activateStartedAdvertisingBlocks(now = new Date()): Promise<number> {
  const result = await prisma.advertising_blocks.updateMany({
    where: {
      startsAt: { lte: now },
      endsAt: { gt: now },
      status: AdvertisingBlockStatus.SCHEDULED,
    },
    data: {
      status: AdvertisingBlockStatus.ACTIVE,
      updatedAt: now,
    },
  });
  return result.count;
}
