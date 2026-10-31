import type { Prisma } from '@prisma/client';

/**
 * Public Discover / Find catalog: staff-promoted registry rows only.
 * Athlete "I'm doing this" creates user-scoped rows (no companyRaceId, isActive false).
 */
export function discoverCatalogWhere(
  extra?: Prisma.race_registryWhereInput
): Prisma.race_registryWhereInput {
  return {
    isActive: true,
    isCancelled: false,
    companyRaceId: { not: null },
    ...extra,
  };
}

/** User-scoped personal registry row — not listed in Discover. */
export function userScopedRegistryWhere(
  extra?: Prisma.race_registryWhereInput
): Prisma.race_registryWhereInput {
  return {
    companyRaceId: null,
    isActive: false,
    ...extra,
  };
}
