import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeGoFastWithMeSlug } from '@/lib/gofast-with-me/gofast-with-me-url-service';
import { getGoFastWithMeBySlug } from '@/lib/gofast-with-me/gofast-with-me-service';

const programInclude = {
  offerings: {
    where: { isActive: true },
    orderBy: [
      { sortOrder: Prisma.SortOrder.asc },
      { createdAt: Prisma.SortOrder.asc },
    ],
  },
} satisfies Prisma.athlete_coach_programsInclude;

export async function ensureAthleteCoachProfile(athleteId: string) {
  return prisma.athlete_coach_profiles.upsert({
    where: { athleteId },
    create: { athleteId },
    update: {},
  });
}

type ProgramWithOfferings = Awaited<
  ReturnType<typeof prisma.athlete_coach_programs.findMany<{ include: typeof programInclude }>>
>[number];

export type AthleteCoachEditorPayload = {
  id: string;
  isCoach: boolean;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  photoURL: string | null;
  myBestRunPhotoURL: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  gofastHandle: string | null;
  athlete_coach_profile: Awaited<
    ReturnType<typeof prisma.athlete_coach_profiles.findUnique>
  >;
  athlete_coach_programs: ProgramWithOfferings[];
};

export async function loadAthleteCoachEditorPayload(
  athleteId: string
): Promise<AthleteCoachEditorPayload | null> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      id: true,
      isCoach: true,
      firstName: true,
      lastName: true,
      email: true,
      photoURL: true,
      myBestRunPhotoURL: true,
      bio: true,
      city: true,
      state: true,
      gofastHandle: true,
      athlete_coach_profile: true,
      athlete_coach_programs: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: programInclude,
      },
    },
  });
  if (!athlete?.isCoach) return null;
  return athlete as AthleteCoachEditorPayload;
}

export type CoachPublicOffering = {
  id: string;
  name: string;
  whatYouGet: string | null;
  priceCents: number | null;
  priceDisplay: string | null;
};

export type CoachPublicProgram = {
  id: string;
  name: string;
  description: string | null;
  philosophy: string | null;
  durationWeeks: number | null;
  type: string;
  offerings: CoachPublicOffering[];
};

export type CoachPublicPagePayload = {
  handle: string;
  athlete: {
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
    bio: string | null;
    city: string | null;
    state: string | null;
    gofastHandle: string | null;
  };
  profile: {
    coachExperienceBio: string | null;
    trainingFocus: string | null;
    trainingMethod: string | null;
    companyName: string | null;
    discoveryCallUrl: string | null;
    city: string | null;
    state: string | null;
  };
  programs: CoachPublicProgram[];
  runnerPageUrl: string | null;
};

function serializeProgram(row: ProgramWithOfferings): CoachPublicProgram {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    philosophy: row.philosophy,
    durationWeeks: row.durationWeeks,
    type: row.type,
    offerings: row.offerings.map((o) => ({
      id: o.id,
      name: o.name,
      whatYouGet: o.whatYouGet,
      priceCents: o.priceCents,
      priceDisplay: o.priceDisplay,
    })),
  };
}

export async function resolveAthleteIdForCoachPublicHandle(
  rawHandle: string
): Promise<{ athleteId: string; handle: string } | null> {
  const handle = normalizeGoFastWithMeSlug(rawHandle || '');
  if (!handle) return null;

  const gwm = await getGoFastWithMeBySlug(handle);
  if (gwm?.athleteId) {
    return { athleteId: gwm.athleteId, handle };
  }

  const athlete = await prisma.athlete.findFirst({
    where: { gofastHandle: { equals: handle, mode: 'insensitive' } },
    select: { id: true, gofastHandle: true },
  });
  if (!athlete?.id) return null;
  return {
    athleteId: athlete.id,
    handle: athlete.gofastHandle?.trim() || handle,
  };
}

export async function loadPublicCoachPage(rawHandle: string): Promise<CoachPublicPagePayload | null> {
  const resolved = await resolveAthleteIdForCoachPublicHandle(rawHandle);
  if (!resolved) return null;

  const athlete = await prisma.athlete.findUnique({
    where: { id: resolved.athleteId },
    select: {
      isCoach: true,
      firstName: true,
      lastName: true,
      photoURL: true,
      myBestRunPhotoURL: true,
      bio: true,
      city: true,
      state: true,
      gofastHandle: true,
      athlete_coach_profile: true,
      athlete_coach_programs: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: programInclude,
      },
    },
  });

  if (!athlete?.isCoach || !athlete.athlete_coach_profile) return null;
  if (!athlete.athlete_coach_profile.isPublished) return null;

  const { runnerPublicLandingUrl } = await import('@/lib/gofast-with-me/runner-public-url');
  const runnerSlug = resolved.handle;

  return {
    handle: resolved.handle,
    athlete: {
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      photoURL: athlete.photoURL?.trim() || athlete.myBestRunPhotoURL?.trim() || null,
      bio: athlete.bio,
      city: athlete.city,
      state: athlete.state,
      gofastHandle: athlete.gofastHandle,
    },
    profile: {
      coachExperienceBio: athlete.athlete_coach_profile.coachExperienceBio,
      trainingFocus: athlete.athlete_coach_profile.trainingFocus,
      trainingMethod: athlete.athlete_coach_profile.trainingMethod,
      companyName: athlete.athlete_coach_profile.companyName,
      discoveryCallUrl: athlete.athlete_coach_profile.discoveryCallUrl,
      city: athlete.athlete_coach_profile.city ?? athlete.city,
      state: athlete.athlete_coach_profile.state ?? athlete.state,
    },
    programs: athlete.athlete_coach_programs.map(serializeProgram),
    runnerPageUrl: runnerSlug ? runnerPublicLandingUrl(runnerSlug) : null,
  };
}

export async function athleteHasPublishedCoachPage(athleteId: string): Promise<boolean> {
  const row = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      isCoach: true,
      athlete_coach_profile: { select: { isPublished: true } },
    },
  });
  return Boolean(row?.isCoach && row.athlete_coach_profile?.isPublished);
}
