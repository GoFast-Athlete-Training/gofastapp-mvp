import { getDiscoveryRunClubs } from "@/lib/domain-run-clubs-discovery";
import type { AdvertisingSurfaceDestination } from "@/lib/advertising-inventory-types";

function resolveClubPublicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://athlete.gofastcrushgoals.com"
  );
}

export async function discoverClubSurfaces(query?: string): Promise<AdvertisingSurfaceDestination[]> {
  const q = query?.trim().toLowerCase() ?? "";
  const clubBase = resolveClubPublicBaseUrl();
  const clubs = await getDiscoveryRunClubs({});

  return clubs
    .map((club) => ({
      surfaceType: "CLUB_PAGE" as const,
      destinationKey: club.slug,
      name: club.name,
      publicUrl: `${clubBase}/runclub/${club.slug}`,
      ownerAthleteId: null,
      city: club.city ?? null,
      state: null,
      memberCount: null,
      engagementSummary: `${club.upcomingRunCount} upcoming run${club.upcomingRunCount === 1 ? "" : "s"}`,
    }))
    .filter((surface) => {
      if (!q) return true;
      const haystack = [surface.name, surface.destinationKey, surface.city, surface.state]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
}
