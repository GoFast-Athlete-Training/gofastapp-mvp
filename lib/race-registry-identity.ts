import type { PrismaClient } from '@prisma/client';

/** UTC midnight window for a calendar race date. */
export function raceDateUtcWindow(raceDate: Date): { gte: Date; lt: Date } {
  const gte = new Date(raceDate);
  gte.setUTCHours(0, 0, 0, 0);
  const lt = new Date(gte);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

/**
 * Match registry rows by case-insensitive name + same calendar date.
 * Used by companypush merge and athlete create reuse.
 */
export async function findRegistryByNameAndDate(
  prisma: PrismaClient,
  name: string,
  raceDate: Date,
  whereExtra?: Parameters<PrismaClient['race_registry']['findFirst']>[0]['where']
) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const window = raceDateUtcWindow(raceDate);
  return prisma.race_registry.findFirst({
    where: {
      name: { equals: trimmed, mode: 'insensitive' },
      raceDate: { gte: window.gte, lt: window.lt },
      ...whereExtra,
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'asc' }],
  });
}

/** Prefer staff-promoted catalog row for athlete reuse. */
export async function findStaffPromotedRegistryByNameAndDate(
  prisma: PrismaClient,
  name: string,
  raceDate: Date
) {
  return findRegistryByNameAndDate(prisma, name, raceDate, {
    companyRaceId: { not: null },
    isActive: true,
  });
}
