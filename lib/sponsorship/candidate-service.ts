import { prisma } from "@/lib/prisma";
import {
  SponsorshipCandidateStatus,
  SponsorshipCandidateType,
  type sponsorship_candidates,
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
    const existing = await prisma.sponsorship_candidates.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Unable to generate unique sponsorship candidate code");
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
  candidateType: SponsorshipCandidateType;
  athleteId: string;
  status: SponsorshipCandidateStatus;
  displayLabel: string | null;
  photoUrl: string | null;
  publicSlug: string | null;
  gofastHandle: string | null;
  followerCount: number;
  runsOnPlatform: number;
};

async function resolveCandidateStats(athleteId: string): Promise<{
  gofastHandle: string | null;
  followerCount: number;
  runsOnPlatform: number;
}> {
  const [athlete, followerCount, runsOnPlatform] = await Promise.all([
    prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { gofastHandle: true },
    }),
    prisma.gofast_container_memberships.count({
      where: { containerAthleteId: athleteId },
    }),
    prisma.city_run_checkins.count({
      where: { athleteId },
    }),
  ]);

  return {
    gofastHandle: athlete?.gofastHandle ?? null,
    followerCount,
    runsOnPlatform,
  };
}

export async function toCandidatePublicFields(
  candidate: sponsorship_candidates,
): Promise<CandidatePublicFields> {
  const stats = await resolveCandidateStats(candidate.athleteId);
  return {
    id: candidate.id,
    code: candidate.code,
    candidateType: candidate.candidateType,
    athleteId: candidate.athleteId,
    status: candidate.status,
    displayLabel: candidate.displayLabel,
    photoUrl: candidate.photoUrl,
    publicSlug: candidate.publicSlugSnapshot,
    gofastHandle: stats.gofastHandle,
    followerCount: stats.followerCount,
    runsOnPlatform: stats.runsOnPlatform,
  };
}

export function validateCandidatePurchaseIdentity(
  candidate: Pick<sponsorship_candidates, "id" | "code" | "status" | "candidateType">,
  candidateId: string,
  candidateCode: string,
): boolean {
  return (
    candidate.id === candidateId &&
    candidate.code === candidateCode &&
    candidate.status === SponsorshipCandidateStatus.ELIGIBLE &&
    candidate.candidateType === SponsorshipCandidateType.ATHLETE
  );
}

export async function ensureSponsorshipCandidateForAthlete(
  athleteId: string,
): Promise<sponsorship_candidates> {
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

  const existing = await prisma.sponsorship_candidates.findUnique({
    where: { athleteId },
  });

  if (existing) {
    return prisma.sponsorship_candidates.update({
      where: { id: existing.id },
      data: {
        status: SponsorshipCandidateStatus.ELIGIBLE,
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

  return prisma.sponsorship_candidates.create({
    data: {
      code,
      candidateType: SponsorshipCandidateType.ATHLETE,
      athleteId,
      status: SponsorshipCandidateStatus.ELIGIBLE,
      eligibleAt: now,
      publicSlugSnapshot,
      displayLabel,
      photoUrl: athlete.photoURL,
    },
  });
}

export async function pauseSponsorshipCandidateForAthlete(
  athleteId: string,
): Promise<sponsorship_candidates | null> {
  const existing = await prisma.sponsorship_candidates.findUnique({
    where: { athleteId },
  });

  if (!existing) return null;

  if (existing.status === SponsorshipCandidateStatus.RETIRED) {
    return existing;
  }

  return prisma.sponsorship_candidates.update({
    where: { id: existing.id },
    data: {
      status: SponsorshipCandidateStatus.PAUSED,
      pausedAt: new Date(),
    },
  });
}

export async function refreshCandidatePresentationFields(
  athleteId: string,
): Promise<sponsorship_candidates | null> {
  const existing = await prisma.sponsorship_candidates.findUnique({
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

  return prisma.sponsorship_candidates.update({
    where: { id: existing.id },
    data: {
      publicSlugSnapshot,
      displayLabel: buildDisplayLabel(athlete),
      photoUrl: athlete.photoURL,
    },
  });
}

export async function listEligibleSponsorshipCandidates(): Promise<CandidatePublicFields[]> {
  const rows = await prisma.sponsorship_candidates.findMany({
    where: {
      status: SponsorshipCandidateStatus.ELIGIBLE,
      candidateType: SponsorshipCandidateType.ATHLETE,
    },
    orderBy: [{ displayLabel: "asc" }, { code: "asc" }],
  });

  return Promise.all(rows.map((row) => toCandidatePublicFields(row)));
}

export async function getEligibleCandidateByCode(
  code: string,
): Promise<CandidatePublicFields | null> {
  const candidate = await prisma.sponsorship_candidates.findFirst({
    where: {
      code,
      status: SponsorshipCandidateStatus.ELIGIBLE,
      candidateType: SponsorshipCandidateType.ATHLETE,
    },
  });

  return candidate ? await toCandidatePublicFields(candidate) : null;
}

export async function getCandidateForPurchase(
  candidateId: string,
  candidateCode: string,
): Promise<sponsorship_candidates | null> {
  const candidate = await prisma.sponsorship_candidates.findFirst({
    where: {
      id: candidateId,
      code: candidateCode,
      status: SponsorshipCandidateStatus.ELIGIBLE,
      candidateType: SponsorshipCandidateType.ATHLETE,
    },
  });
  return candidate;
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
    const existing = await prisma.sponsorship_candidates.findUnique({
      where: { athleteId: athlete.id },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await ensureSponsorshipCandidateForAthlete(athlete.id);
    ensured += 1;
  }

  return {
    scanned: athletes.length,
    ensured,
    skipped,
  };
}
