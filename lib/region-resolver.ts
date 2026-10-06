import { prisma } from '@/lib/prisma';
import { inferRegionSlugFromCitySlug } from '@/lib/region-slug';

/** Prefer region slug from cities.region FK; fallback to sync map. */
export async function resolveRegionSlugFromCitySlug(
  citySlug: string | null | undefined
): Promise<string | null> {
  const normalized = citySlug?.trim().toLowerCase();
  if (!normalized || normalized === 'unknown') return null;

  const city = await prisma.cities.findFirst({
    where: { slug: { equals: normalized, mode: 'insensitive' } },
    select: { region: { select: { slug: true } } },
  });

  const fromDb = city?.region?.slug?.trim();
  if (fromDb) return fromDb;

  return inferRegionSlugFromCitySlug(normalized);
}
