import { prisma } from '@/lib/prisma';
import { normalizeGoFastWithMeSlug } from '@/lib/gofast-with-me/gofast-with-me-url-service';

export const ROUTE_PUBLIC_SELECT = {
  id: true,
  name: true,
  stravaUrl: true,
  distanceMiles: true,
  stravaMapUrl: true,
  mapImageUrl: true,
  routePhotos: true,
  routeNeighborhood: true,
  routeDescription: true,
  runType: true,
  citySlug: true,
  createdByAthleteId: true,
} as const;

export type RoutePublicRow = {
  id: string;
  name: string;
  stravaUrl: string | null;
  distanceMiles: number | null;
  stravaMapUrl: string | null;
  mapImageUrl: string | null;
  routePhotos: unknown;
  routeNeighborhood: string | null;
  routeDescription: string | null;
  runType: string | null;
  citySlug: string | null;
  createdByAthleteId: string;
};

/** Public handle for URLs — gofastHandle, else GoFast With Me slug snapshot. */
export async function publicHandleForAthleteId(
  athleteId: string,
): Promise<string | null> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      gofastHandle: true,
      gofast_with_me: { select: { gofastSlugSnapshot: true } },
    },
  });
  if (!athlete) return null;
  const raw =
    athlete.gofastHandle?.trim() ||
    athlete.gofast_with_me?.gofastSlugSnapshot?.trim() ||
    null;
  return raw ? normalizeGoFastWithMeSlug(raw) : null;
}

export async function publicHandleForRoute(
  route: Pick<RoutePublicRow, 'createdByAthleteId'>,
): Promise<string | null> {
  return publicHandleForAthleteId(route.createdByAthleteId);
}

/**
 * Resolve a URL segment to routes.id — id first; add slug lookup when routes.slug exists.
 */
export async function resolveRouteIdBySegment(
  segment: string,
): Promise<string | null> {
  const s = segment.trim();
  if (!s) return null;

  const byId = await prisma.routes.findUnique({
    where: { id: s },
    select: { id: true },
  });
  if (byId) return byId.id;

  return null;
}

export async function loadPublicRouteBySegment(
  segment: string,
): Promise<RoutePublicRow | null> {
  const id = await resolveRouteIdBySegment(segment);
  if (!id) return null;

  return prisma.routes.findUnique({
    where: { id },
    select: ROUTE_PUBLIC_SELECT,
  });
}

export function normalizeRoutePhotoUrls(routePhotos: unknown): string[] {
  if (!Array.isArray(routePhotos)) return [];
  return routePhotos
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .map((u) => u.trim());
}
