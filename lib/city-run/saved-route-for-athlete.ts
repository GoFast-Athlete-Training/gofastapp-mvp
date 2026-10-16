import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const routeSelect = {
  id: true,
  name: true,
  stravaUrl: true,
  stravaMapUrl: true,
  mapImageUrl: true,
  routePhotos: true,
  routeNeighborhood: true,
  routeDescription: true,
  runType: true,
  distanceMiles: true,
  citySlug: true,
  createdByAthleteId: true,
} as const;

export type SavedRouteForAthlete = Awaited<
  ReturnType<typeof resolveSavedRouteForAthlete>
> extends infer R
  ? R extends null
    ? never
    : R
  : never;

function normalizeRoutePhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
}

/** Route the athlete may attach to a city run (catalog owner only — not My Routes curation). */
export async function resolveSavedRouteForAthlete(
  athleteId: string,
  routeId: string
) {
  const id = routeId.trim();
  if (!id) return null;

  const route = await prisma.routes.findUnique({
    where: { id },
    select: routeSelect,
  });
  if (!route) return null;

  if (route.createdByAthleteId === athleteId) return route;

  return null;
}

export type CityRunRouteMediaFromSavedRoute = {
  routeId: string;
  stravaMapUrl: string | null;
  mapImageUrl: string | null;
  routePhotos: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  routeNeighborhood: string | null;
  runType: string | null;
  totalMiles: number | null;
};

export function cityRunMediaFromSavedRoute(
  route: NonNullable<Awaited<ReturnType<typeof resolveSavedRouteForAthlete>>>
): CityRunRouteMediaFromSavedRoute {
  const photos = normalizeRoutePhotos(route.routePhotos);
  const stravaMapUrl = route.stravaMapUrl?.trim() || route.stravaUrl?.trim() || null;

  return {
    routeId: route.id,
    stravaMapUrl,
    mapImageUrl: route.mapImageUrl?.trim() || null,
    routePhotos: photos.length > 0 ? photos : Prisma.JsonNull,
    routeNeighborhood: route.routeNeighborhood?.trim() || null,
    runType: route.runType?.trim() || null,
    totalMiles:
      route.distanceMiles != null && Number.isFinite(route.distanceMiles) && route.distanceMiles > 0
        ? route.distanceMiles
        : null,
  };
}
