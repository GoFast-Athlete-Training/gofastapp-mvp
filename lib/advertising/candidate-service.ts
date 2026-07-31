import { prisma } from "@/lib/prisma";
import {
  AdvertisingCandidateStatus,
  AdvertisingCandidateType,
  type advertising_candidates,
  type Athlete,
} from "@prisma/client";
import { randomBytes } from "crypto";

const CODE_PREFIX = "GFA";
const CODE_SEGMENT_LENGTH = 8;

function buildCandidateCode(): string {
  const segment = randomBytes(6).toString("base64url").slice(0, CODE_SEGMENT_LENGTH).toUpperCase();
  return `${CODE_PREFIX}-${segment}`;
}

async function generateUniqueCandidateCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = buildCandidateCode();
    const existing = await prisma.advertising_candidates.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Unable to generate unique advertising candidate code");
}

function buildDisplayLabel(athlete: Pick<Athlete, "firstName" | "lastName" | "gofastHandle">): string {
  const fullName = [athlete.firstName, athlete.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (athlete.gofastHandle) return athlete.gofastHandle;
  return "GoFast Athlete";
}

async function resolvePublicSlugSnapshot(athleteId: string): Promise<string | null> {
  const profile = await prisma.gofast_with_me.findUnique({
    where: { athleteId },
    select: { gofastSlugSnapshot: true },
  });
  return profile?.gofastSlugSnapshot ?? null;
}

export type CandidatePublicFields = {
  id: string;
  code: string;
  candidateType: AdvertisingCandidateType;
  athleteId: string;
  status: AdvertisingCandidateStatus;
  displayLabel: string | null;
  photoUrl: string | null;
  publicSlug: string | null;
};

export function toCandidatePublicFields(
  candidate: advertising_candidates,
): CandidatePublicFields {
  return {
    id: candidate.id,
    code: candidate.code,
    candidateType: candidate.candidateType,
    athleteId: candidate.athleteId,
    status: candidate.status,
    displayLabel: candidate.displayLabel,
    photoUrl: candidate.photoUrl,
    publicSlug: candidate.publicSlugSnapshot,
  };
}

export async function ensureAdvertisingCandidateForAthlete(
  athleteId: string,
): Promise<advertising_candidates> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gofastHandle: true,
      photoURL: true,
      isGoFastContainer: true,
    },
  });

  if (!athlete) {
    throw new Error(`Athlete not found: ${athleteId}`);
  }

  if (!athlete.isGoFastContainer) {
    throw new Error("Athlete is not container-enabled");
  }

  const publicSlugSnapshot = await resolvePublicSlugSnapshot(athleteId);
  const displayLabel = buildDisplayLabel(athlete);
  const now = new Date();

  const existing = await prisma.advertising_candidates.findUnique({
    where: { athleteId },
  });

  if (existing) {
    return prisma.advertising_candidates.update({
      where: { id: existing.id },
      data: {
        status: AdvertisingCandidateStatus.ELIGIBLE,
        eligibleAt: existing.eligibleAt ?? now,
        pausedAt: null,
        retiredAt: null,
        publicSlugSnapshot,
        displayLabel,
        photoUrl: athlete.photoURL,
      },
    });
  }

  const code = await generateUniqueCandidateCode();

  return prisma.advertising_candidates.create({
    data: {
      code,
      candidateType: AdvertisingCandidateType.ATHLETE,
      athleteId,
      status: AdvertisingCandidateStatus.ELIGIBLE,
      eligibleAt: now,
      publicSlugSnapshot,
      displayLabel,
      photoUrl: athlete.photoURL,
    },
  });
}

export async function pauseAdvertisingCandidateForAthlete(
  athleteId: string,
): Promise<advertising_candidates | null> {
  const existing = await prisma.advertising_candidates.findUnique({
    where: { athleteId },
  });

  if (!existing) return null;

  if (existing.status === AdvertisingCandidateStatus.RETIRED) {
    return existing;
  }

  return prisma.advertising_candidates.update({
    where: { id: existing.id },
    data: {
      status: AdvertisingCandidateStatus.PAUSED,
      pausedAt: new Date(),
    },
  });
}

export async function refreshCandidatePresentationFields(
  athleteId: string,
): Promise<advertising_candidates | null> {
  const existing = await prisma.advertising_candidates.findUnique({
    where: { athleteId },
  });
  if (!existing) return null;

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      firstName: true,
      lastName: true,
      gofastHandle: true,
      photoURL: true,
    },
  });
  if (!athlete) return existing;

  const publicSlugSnapshot = await resolvePublicSlugSnapshot(athleteId);

  return prisma.advertising_candidates.update({
    where: { id: existing.id },
    data: {
      publicSlugSnapshot,
      displayLabel: buildDisplayLabel(athlete),
      photoUrl: athlete.photoURL,
    },
  });
}

export async function listEligibleAdvertisingCandidates(): Promise<CandidatePublicFields[]> {
  const rows = await prisma.advertising_candidates.findMany({
    where: {
      status: AdvertisingCandidateStatus.ELIGIBLE,
      candidateType: AdvertisingCandidateType.ATHLETE,
    },
    orderBy: [{ displayLabel: "asc" }, { code: "asc" }],
  });

  return rows.map(toCandidatePublicFields);
}

export async function getEligibleCandidateByCode(
  code: string,
): Promise<CandidatePublicFields | null> {
  const candidate = await prisma.advertising_candidates.findFirst({
    where: {
      code,
      status: AdvertisingCandidateStatus.ELIGIBLE,
      candidateType: AdvertisingCandidateType.ATHLETE,
    },
  });

  return candidate ? toCandidatePublicFields(candidate) : null;
}

export function validateCandidatePurchaseIdentity(
  candidate: Pick<advertising_candidates, "id" | "code" | "status" | "candidateType">,
  candidateId: string,
  candidateCode: string,
): boolean {
  return (
    candidate.id === candidateId &&
    candidate.code === candidateCode &&
    candidate.status === AdvertisingCandidateStatus.ELIGIBLE &&
    candidate.candidateType === AdvertisingCandidateType.ATHLETE
  );
}

export async function getCandidateForPurchase(
  candidateId: string,
  candidateCode: string,
): Promise<advertising_candidates | null> {
  const candidate = await prisma.advertising_candidates.findFirst({
    where: {
      id: candidateId,
      code: candidateCode,
      status: AdvertisingCandidateStatus.ELIGIBLE,
      candidateType: AdvertisingCandidateType.ATHLETE,
    },
  });
  return candidate;
}

/** @deprecated Use getCandidateForPurchase with candidate code validation */
export async function getCandidateByIdForPurchase(
  candidateId: string,
): Promise<advertising_candidates | null> {
  return prisma.advertising_candidates.findFirst({
    where: {
      id: candidateId,
      status: AdvertisingCandidateStatus.ELIGIBLE,
      candidateType: AdvertisingCandidateType.ATHLETE,
    },
  });
}

export async function backfillEligibleContainerCandidates(): Promise<{
  scanned: number;
  ensured: number;
  skipped: number;
}> {
  const athletes = await prisma.athlete.findMany({
    where: { isGoFastContainer: true },
    select: { id: true },
  });

  let ensured = 0;
  let skipped = 0;

  for (const athlete of athletes) {
    const existing = await prisma.advertising_candidates.findUnique({
      where: { athleteId: athlete.id },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await ensureAdvertisingCandidateForAthlete(athlete.id);
    ensured += 1;
  }

  return {
    scanned: athletes.length,
    ensured,
    skipped,
  };
}
