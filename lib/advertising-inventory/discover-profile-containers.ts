import { prisma } from "@/lib/prisma";
import type { AdvertisingSurfaceDestination } from "@/lib/advertising-inventory-types";

function resolveRunnerPublicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_RUNNER_PHOTO_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://runner.gofastcrushgoals.com"
  );
}

function displayName(firstName: string | null, lastName: string | null, handle: string): string {
  const composed = [firstName, lastName].filter(Boolean).join(" ");
  return composed || `@${handle}`;
}

/**
 * Athletes who published a GoFast profile container (opt-in inventory).
 * Eligibility: isGoFastContainer + public gofastHandle.
 */
export async function discoverProfileContainerSurfaces(query?: string): Promise<AdvertisingSurfaceDestination[]> {
  const q = query?.trim().toLowerCase() ?? "";
  const runnerBase = resolveRunnerPublicBaseUrl();

  const athletes = await prisma.athlete.findMany({
    where: {
      isGoFastContainer: true,
      gofastHandle: { not: null },
      ...(q
        ? {
            OR: [
              { gofastHandle: { contains: q, mode: "insensitive" } },
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      gofastHandle: true,
      firstName: true,
      lastName: true,
      city: true,
      state: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  if (!athletes.length) return [];

  const athleteIds = athletes.map((a) => a.id);
  const memberCounts = await prisma.gofast_container_memberships.groupBy({
    by: ["containerAthleteId"],
    where: { containerAthleteId: { in: athleteIds } },
    _count: { _all: true },
  });
  const countByHost = new Map(memberCounts.map((row) => [row.containerAthleteId, row._count._all]));

  return athletes
    .map((athlete) => {
      const handle = athlete.gofastHandle!.trim().toLowerCase();
      const memberCount = countByHost.get(athlete.id) ?? 0;
      return {
        surfaceType: "PROFILE_CONTAINER" as const,
        destinationKey: handle,
        name: displayName(athlete.firstName, athlete.lastName, handle),
        publicUrl: `${runnerBase}/${handle}`,
        ownerAthleteId: athlete.id,
        city: athlete.city,
        state: athlete.state,
        memberCount,
        engagementSummary:
          memberCount > 0
            ? `${memberCount} community member${memberCount === 1 ? "" : "s"} · public Run With Me page`
            : "Public Run With Me page · community open",
      };
    })
    .filter((surface) => {
      if (!q) return true;
      const haystack = [surface.name, surface.destinationKey, surface.city, surface.state]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
}
