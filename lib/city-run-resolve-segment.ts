import { prisma } from '@/lib/prisma';

/**
 * Resolve a URL segment to city_runs.id — tries id first, then slug (matches public RSVP GET).
 */
export async function resolveCityRunIdBySegment(segment: string): Promise<string | null> {
  const s = segment.trim();
  if (!s) return null;

  const byId = await prisma.city_runs.findUnique({
    where: { id: s },
    select: { id: true },
  });
  if (byId) return byId.id;

  const bySlug = await prisma.city_runs.findUnique({
    where: { slug: s },
    select: { id: true },
  });
  return bySlug?.id ?? null;
}
