import { prisma } from './prisma';
import { getDiscoveryRuns, type GetRunsFilters } from '@/lib/domain-runs';

export type DiscoveryRunClubFilters = {
  citySlug?: string;
};

export type DiscoveryRunClubItem = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
  citySlug: string | null;
  upcomingRunCount: number;
  nextRun: Awaited<ReturnType<typeof getDiscoveryRuns>>[number] | null;
  runs: Awaited<ReturnType<typeof getDiscoveryRuns>>;
};

/**
 * Authenticated app club directory: all Product run_clubs with discovery run metadata.
 * Clubs remain visible even when they have no current discovery-visible runs.
 */
export async function getDiscoveryRunClubs(
  filters: DiscoveryRunClubFilters = {}
): Promise<DiscoveryRunClubItem[]> {
  const clubWhere: Record<string, unknown> = {};
  if (filters.citySlug) {
    clubWhere.citySlug = filters.citySlug;
  }

  const clubs = await prisma.run_clubs.findMany({
    where: clubWhere,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      city: true,
      citySlug: true,
    },
  });

  const runFilters: GetRunsFilters = {};
  if (filters.citySlug) {
    runFilters.citySlug = filters.citySlug;
  }

  const discoveryRuns = await getDiscoveryRuns(runFilters);
  const runsByClubId = new Map<string, typeof discoveryRuns>();

  for (const run of discoveryRuns) {
    const clubId = run.runClubId;
    if (!clubId) continue;
    const list = runsByClubId.get(clubId) ?? [];
    list.push(run);
    runsByClubId.set(clubId, list);
  }

  return clubs.map((club) => {
    const runs = runsByClubId.get(club.id) ?? [];
    return {
      id: club.id,
      slug: club.slug,
      name: club.name,
      logoUrl: club.logoUrl,
      city: club.city,
      citySlug: club.citySlug,
      upcomingRunCount: runs.length,
      nextRun: runs[0] ?? null,
      runs,
    };
  });
}
