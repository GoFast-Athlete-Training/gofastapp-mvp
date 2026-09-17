import { prisma } from '@/lib/prisma';
import {
  slugifyAthleteCompanyName,
  toPublicAthleteCompany,
  type AthleteCompanyRecord,
  type PublicAthleteCompany,
} from '@/lib/athlete-company/athlete-company-public';

export type { AthleteCompanyRecord, PublicAthleteCompany };
export { slugifyAthleteCompanyName, toPublicAthleteCompany };

export type UpsertAthleteCompanyInput = {
  name: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  const trimmed = trimOrNull(raw);
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function toRecord(row: {
  id: string;
  athleteId: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
}): AthleteCompanyRecord {
  return {
    id: row.id,
    athleteId: row.athleteId,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logoUrl,
    websiteUrl: row.websiteUrl,
  };
}

export async function getAthleteCompanyForAthlete(
  athleteId: string
): Promise<AthleteCompanyRecord | null> {
  const row = await prisma.athlete_companies.findUnique({
    where: { athleteId },
  });
  return row ? toRecord(row) : null;
}

async function resolveUniqueSlug(
  baseSlug: string,
  excludeCompanyId?: string
): Promise<string> {
  let candidate = baseSlug;
  let suffix = 2;
  while (true) {
    const taken = await prisma.athlete_companies.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken || (excludeCompanyId && taken.id === excludeCompanyId)) {
      return candidate;
    }
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function upsertAthleteCompanyForAthlete(
  athleteId: string,
  input: UpsertAthleteCompanyInput
): Promise<AthleteCompanyRecord> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Business name is required');
  }

  const logoUrl = input.logoUrl !== undefined ? trimOrNull(input.logoUrl) : undefined;
  const websiteUrl =
    input.websiteUrl !== undefined ? normalizeWebsiteUrl(input.websiteUrl) : undefined;

  const existing = await prisma.athlete_companies.findUnique({
    where: { athleteId },
  });

  if (existing) {
    const slug =
      existing.slug ??
      (await resolveUniqueSlug(slugifyAthleteCompanyName(name), existing.id));
    const updated = await prisma.athlete_companies.update({
      where: { athleteId },
      data: {
        name,
        slug,
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(websiteUrl !== undefined ? { websiteUrl } : {}),
        updatedAt: new Date(),
      },
    });
    return toRecord(updated);
  }

  const slug = await resolveUniqueSlug(slugifyAthleteCompanyName(name));
  const created = await prisma.athlete_companies.create({
    data: {
      athleteId,
      name,
      slug,
      logoUrl: logoUrl ?? null,
      websiteUrl: websiteUrl ?? null,
    },
  });
  return toRecord(created);
}
