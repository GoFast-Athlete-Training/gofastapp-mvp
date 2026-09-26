import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isClubManagerWriteRole } from '@/lib/run-club-leader-scope';

export type CityRunRouteRow = {
  id: string;
  routeId: string | null;
  title: string;
  citySlug: string | null;
  stravaMapUrl: string | null;
  mapImageUrl: string | null;
  routePhotos: unknown;
  routeNeighborhood: string | null;
  directionsText: string | null;
  runType: string | null;
  totalMiles: number | null;
  athleteGeneratedId: string | null;
  runClubId: string | null;
};

const cityRunRouteSelect = {
  id: true,
  routeId: true,
  title: true,
  citySlug: true,
  stravaMapUrl: true,
  mapImageUrl: true,
  routePhotos: true,
  routeNeighborhood: true,
  directionsText: true,
  runType: true,
  totalMiles: true,
  athleteGeneratedId: true,
  runClubId: true,
} as const;

function hasLegacyRouteMapData(run: CityRunRouteRow): boolean {
  if (run.stravaMapUrl?.trim()) return true;
  if (run.mapImageUrl?.trim()) return true;
  if (run.routeNeighborhood?.trim()) return true;
  if (Array.isArray(run.routePhotos) && run.routePhotos.length > 0) return true;
  return false;
}

function normalizeRoutePhotos(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!Array.isArray(value)) return Prisma.JsonNull;
  const urls = value.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  return urls.length > 0 ? urls : Prisma.JsonNull;
}

async function resolveRouteAuthorAthleteId(run: CityRunRouteRow): Promise<string | null> {
  if (run.athleteGeneratedId?.trim()) return run.athleteGeneratedId.trim();
  if (!run.runClubId) return null;

  const memberships = await prisma.run_club_memberships.findMany({
    where: { runClubId: run.runClubId, status: 'active' },
    select: { athleteId: true, role: true },
    take: 20,
  });
  const writer = memberships.find((m) => isClubManagerWriteRole(m.role));
  return writer?.athleteId ?? memberships[0]?.athleteId ?? null;
}

/**
 * When a city run has legacy map fields but no routes row, materialize routes + routeId.
 * City-run columns stay in place as legacy fallback.
 */
export async function ensureCityRunRoute(cityRunId: string): Promise<string | null> {
  const run = await prisma.city_runs.findUnique({
    where: { id: cityRunId },
    select: cityRunRouteSelect,
  });
  if (!run) return null;
  if (run.routeId?.trim()) return run.routeId.trim();
  if (!hasLegacyRouteMapData(run)) return null;

  const createdByAthleteId = await resolveRouteAuthorAthleteId(run);
  if (!createdByAthleteId) return null;

  const route = await prisma.routes.create({
    data: {
      name: run.title.trim() || 'Route',
      stravaMapUrl: run.stravaMapUrl?.trim() || null,
      mapImageUrl: run.mapImageUrl?.trim() || null,
      routePhotos: normalizeRoutePhotos(run.routePhotos),
      routeNeighborhood: run.routeNeighborhood?.trim() || null,
      runType: run.runType?.trim() || null,
      citySlug: run.citySlug?.trim() || null,
      distanceMiles: run.totalMiles ?? null,
      createdByAthleteId,
      updatedAt: new Date(),
    },
  });

  await prisma.city_runs.update({
    where: { id: cityRunId },
    data: { routeId: route.id, updatedAt: new Date() },
  });

  return route.id;
}

export type CityRunRouteFieldPatch = {
  stravaMapUrl?: string | null;
  mapImageUrl?: string | null;
  routePhotos?: string[] | null;
  routeNeighborhood?: string | null;
  runType?: string | null;
  totalMiles?: number | null;
  title?: string | null;
  citySlug?: string | null;
};

/** Mirror route map fields onto the linked routes row after city_run save. */
export async function syncCityRunRouteFromFields(
  cityRunId: string,
  patch: CityRunRouteFieldPatch
): Promise<void> {
  const routeId = (await ensureCityRunRoute(cityRunId)) ?? undefined;
  if (!routeId) {
    const row = await prisma.city_runs.findUnique({
      where: { id: cityRunId },
      select: { routeId: true },
    });
    if (!row?.routeId) return;
  }

  const resolvedRouteId =
    routeId ??
    (
      await prisma.city_runs.findUnique({
        where: { id: cityRunId },
        select: { routeId: true },
      })
    )?.routeId;
  if (!resolvedRouteId) return;

  const data: Prisma.routesUpdateInput = { updatedAt: new Date() };
  if (patch.stravaMapUrl !== undefined) {
    data.stravaMapUrl = patch.stravaMapUrl?.trim() || null;
  }
  if (patch.mapImageUrl !== undefined) {
    data.mapImageUrl = patch.mapImageUrl?.trim() || null;
  }
  if (patch.routePhotos !== undefined) {
    data.routePhotos = normalizeRoutePhotos(patch.routePhotos);
  }
  if (patch.routeNeighborhood !== undefined) {
    data.routeNeighborhood = patch.routeNeighborhood?.trim() || null;
  }
  if (patch.runType !== undefined) {
    data.runType = patch.runType?.trim() || null;
  }
  if (patch.totalMiles !== undefined) {
    data.distanceMiles = patch.totalMiles;
  }
  if (patch.title !== undefined && patch.title?.trim()) {
    data.name = patch.title.trim();
  }
  if (patch.citySlug !== undefined) {
    data.citySlug = patch.citySlug?.trim() || null;
  }

  if (Object.keys(data).length <= 1) return;

  await prisma.routes.update({
    where: { id: resolvedRouteId },
    data,
  });
}

export async function loadCityRunWithRoute(cityRunId: string) {
  await ensureCityRunRoute(cityRunId);
  return prisma.city_runs.findUnique({
    where: { id: cityRunId },
    include: {
      route: {
        select: {
          id: true,
          name: true,
          stravaUrl: true,
          stravaMapUrl: true,
          mapImageUrl: true,
          routePhotos: true,
          routeNeighborhood: true,
          runType: true,
          distanceMiles: true,
          citySlug: true,
        },
      },
    },
  });
}
