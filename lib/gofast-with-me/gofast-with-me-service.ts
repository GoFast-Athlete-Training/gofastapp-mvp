import { prisma } from '@/lib/prisma';
import {
  buildGoFastWithMeUrl,
  normalizeGoFastWithMeSlug,
} from '@/lib/gofast-with-me/gofast-with-me-url-service';

export { normalizeGoFastWithMeSlug, buildGoFastWithMeUrl };

export type GoFastWithMeCreatorType = 'person' | 'coach';

export type GoFastWithMeRecord = {
  id: string;
  athleteId: string;
  gofastSlugSnapshot: string;
  slugUsesHandle: boolean;
  welcome: string | null;
  gofastWithMeBio: string | null;
  whatYoullSeeHere: string | null;
  sportFocus: string | null;
  modelFocus: string | null;
  myAchievements: string | null;
  gofastWithMePhotoUrl: string | null;
  creatorType: GoFastWithMeCreatorType | null;
  coachSpecialty: string | null;
};

export type GoFastWithMeIntroInput = {
  welcome?: string | null;
  gofastWithMeBio?: string | null;
  whatYoullSeeHere?: string | null;
  sportFocus?: string | null;
  modelFocus?: string | null;
  myAchievements?: string | null;
  gofastWithMePhotoUrl?: string | null;
  creatorType?: GoFastWithMeCreatorType | string | null;
  coachSpecialty?: string | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeCreatorType(value: string | null | undefined): GoFastWithMeCreatorType | null {
  const v = trimOrNull(value);
  if (v === 'person' || v === 'coach') return v;
  return null;
}

type GoFastWithMeRow = {
  id: string;
  athleteId: string;
  gofastSlugSnapshot: string;
  slugUsesHandle: boolean;
  welcome: string | null;
  gofastWithMeBio: string | null;
  whatYoullSeeHere: string | null;
  sportFocus: string | null;
  modelFocus: string | null;
  myAchievements: string | null;
  gofastWithMePhotoUrl: string | null;
  creatorType: string | null;
  coachSpecialty: string | null;
};

function toGoFastWithMeRecord(row: GoFastWithMeRow): GoFastWithMeRecord {
  return {
    ...row,
    creatorType: normalizeCreatorType(row.creatorType),
  };
}

export async function isGoFastWithMeSlugAvailable(
  slug: string,
  excludeAthleteId?: string
): Promise<boolean> {
  const normalized = normalizeGoFastWithMeSlug(slug);
  if (!normalized) return false;

  const taken = await prisma.gofast_with_me.findUnique({
    where: { gofastSlugSnapshot: normalized },
    select: { athleteId: true },
  });
  if (!taken) return true;
  return excludeAthleteId != null && taken.athleteId === excludeAthleteId;
}

/**
 * Ensure a gofast_with_me row exists for an athlete with a handle.
 * When slugUsesHandle is true, syncs gofastSlugSnapshot from the current handle.
 */
export async function ensureGoFastWithMeForAthlete(
  athleteId: string,
  gofastHandle: string,
  options?: { seedBioFromAthlete?: string | null; seedPhotoFromAthlete?: string | null }
): Promise<GoFastWithMeRecord> {
  const slug = normalizeGoFastWithMeSlug(gofastHandle);
  if (!slug) {
    throw new Error('Invalid handle for GoFast With Me');
  }

  const existingByAthlete = await prisma.gofast_with_me.findUnique({
    where: { athleteId },
  });

  if (existingByAthlete) {
    const seedPhoto = trimOrNull(options?.seedPhotoFromAthlete ?? undefined);
    if (!existingByAthlete.gofastWithMePhotoUrl && seedPhoto) {
      const updated = await prisma.gofast_with_me.update({
        where: { athleteId },
        data: { gofastWithMePhotoUrl: seedPhoto, updatedAt: new Date() },
      });
      return toGoFastWithMeRecord(updated);
    }
    if (existingByAthlete.slugUsesHandle && existingByAthlete.gofastSlugSnapshot !== slug) {
      const available = await isGoFastWithMeSlugAvailable(slug, athleteId);
      if (!available) {
        throw new Error('GoFast With Me URL already taken');
      }
      const updated = await prisma.gofast_with_me.update({
        where: { athleteId },
        data: { gofastSlugSnapshot: slug, updatedAt: new Date() },
      });
      return toGoFastWithMeRecord(updated);
    }
    return toGoFastWithMeRecord(existingByAthlete);
  }

  const available = await isGoFastWithMeSlugAvailable(slug, athleteId);
  if (!available) {
    throw new Error('GoFast With Me URL already taken');
  }

  const seedBio = trimOrNull(options?.seedBioFromAthlete ?? undefined);
  const seedPhoto = trimOrNull(options?.seedPhotoFromAthlete ?? undefined);

  const created = await prisma.gofast_with_me.create({
    data: {
      athleteId,
      gofastSlugSnapshot: slug,
      slugUsesHandle: true,
      gofastWithMeBio: seedBio,
      gofastWithMePhotoUrl: seedPhoto,
      updatedAt: new Date(),
    },
  });
  return toGoFastWithMeRecord(created);
}

export async function getGoFastWithMeBySlug(slug: string) {
  const normalized = normalizeGoFastWithMeSlug(slug);
  if (!normalized) return null;
  return prisma.gofast_with_me.findUnique({
    where: { gofastSlugSnapshot: normalized },
    include: { athlete: true },
  });
}

export async function getGoFastWithMeForAthlete(athleteId: string) {
  return prisma.gofast_with_me.findUnique({
    where: { athleteId },
  });
}

export async function updateGoFastWithMeIntro(
  athleteId: string,
  input: GoFastWithMeIntroInput
) {
  const page = await prisma.gofast_with_me.findUnique({ where: { athleteId } });
  if (!page) {
    throw new Error('GoFast With Me not found — set your handle first');
  }

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (input.welcome !== undefined) data.welcome = trimOrNull(input.welcome);
  if (input.gofastWithMeBio !== undefined) {
    data.gofastWithMeBio = trimOrNull(input.gofastWithMeBio);
  }
  if (input.whatYoullSeeHere !== undefined) {
    data.whatYoullSeeHere = trimOrNull(input.whatYoullSeeHere);
  }
  if (input.sportFocus !== undefined) data.sportFocus = trimOrNull(input.sportFocus);
  if (input.modelFocus !== undefined) data.modelFocus = trimOrNull(input.modelFocus);
  if (input.myAchievements !== undefined) {
    data.myAchievements = trimOrNull(input.myAchievements);
  }
  if (input.gofastWithMePhotoUrl !== undefined) {
    data.gofastWithMePhotoUrl = trimOrNull(input.gofastWithMePhotoUrl);
  }
  if (input.creatorType !== undefined) {
    const ct = normalizeCreatorType(input.creatorType);
    if (input.creatorType != null && input.creatorType !== '' && !ct) {
      throw new Error('creatorType must be "person" or "coach"');
    }
    data.creatorType = ct;
    if (ct === 'person') {
      data.coachSpecialty = null;
    }
  }
  if (input.coachSpecialty !== undefined) {
    data.coachSpecialty = trimOrNull(input.coachSpecialty);
  }

  return prisma.gofast_with_me.update({
    where: { athleteId },
    data,
  });
}

/** Set a custom GoFast With Me URL slug (disables handle sync). */
export async function setGoFastWithMeSlug(athleteId: string, rawSlug: string) {
  const slug = normalizeGoFastWithMeSlug(rawSlug);
  if (!slug) {
    throw new Error('Invalid GoFast With Me URL');
  }

  const page = await prisma.gofast_with_me.findUnique({ where: { athleteId } });
  if (!page) {
    throw new Error('GoFast With Me not found — set your handle first');
  }

  if (page.gofastSlugSnapshot !== slug) {
    const available = await isGoFastWithMeSlugAvailable(slug, athleteId);
    if (!available) {
      throw new Error('GoFast With Me URL already taken');
    }
  }

  return prisma.gofast_with_me.update({
    where: { athleteId },
    data: {
      gofastSlugSnapshot: slug,
      slugUsesHandle: false,
      updatedAt: new Date(),
    },
  });
}

/** Re-enable handle-based URL and sync slug from current handle. */
export async function useGoFastHandleForUrl(athleteId: string, gofastHandle: string) {
  const slug = normalizeGoFastWithMeSlug(gofastHandle);
  if (!slug) {
    throw new Error('Invalid handle for GoFast With Me URL');
  }

  const page = await prisma.gofast_with_me.findUnique({ where: { athleteId } });
  if (!page) {
    throw new Error('GoFast With Me not found — set your handle first');
  }

  if (page.gofastSlugSnapshot !== slug) {
    const available = await isGoFastWithMeSlugAvailable(slug, athleteId);
    if (!available) {
      throw new Error('GoFast With Me URL already taken');
    }
  }

  return prisma.gofast_with_me.update({
    where: { athleteId },
    data: {
      gofastSlugSnapshot: slug,
      slugUsesHandle: true,
      updatedAt: new Date(),
    },
  });
}
