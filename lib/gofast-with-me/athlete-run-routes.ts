import { prisma } from '@/lib/prisma';

export type AthleteRunRouteVisibility = 'draft' | 'published';

export type AthleteRunRouteCatalogPayload = {
  id: string;
  name: string;
  stravaUrl: string | null;
  stravaMapUrl: string | null;
  mapImageUrl: string | null;
  distanceMiles: number | null;
  routeNeighborhood: string | null;
  citySlug: string | null;
  createdByAthleteId: string;
  contributorFirstName: string | null;
  contributorHandle: string | null;
};

export type AthleteRunRoutePayload = {
  id: string;
  routeId: string;
  caption: string | null;
  sortOrder: number;
  visibility: AthleteRunRouteVisibility;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  route: AthleteRunRouteCatalogPayload;
};

const routeInclude = {
  route: {
    select: {
      id: true,
      name: true,
      stravaUrl: true,
      stravaMapUrl: true,
      mapImageUrl: true,
      distanceMiles: true,
      routeNeighborhood: true,
      citySlug: true,
      createdByAthleteId: true,
      createdBy: {
        select: {
          firstName: true,
          gofastHandle: true,
        },
      },
    },
  },
} as const;

type AthleteRunRouteRow = {
  id: string;
  routeId: string;
  caption: string | null;
  sortOrder: number;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  route: {
    id: string;
    name: string;
    stravaUrl: string | null;
    stravaMapUrl: string | null;
    mapImageUrl: string | null;
    distanceMiles: number | null;
    routeNeighborhood: string | null;
    citySlug: string | null;
    createdByAthleteId: string;
    createdBy: {
      firstName: string | null;
      gofastHandle: string | null;
    };
  };
};

export function mapAthleteRunRoute(row: AthleteRunRouteRow): AthleteRunRoutePayload {
  return {
    id: row.id,
    routeId: row.routeId,
    caption: row.caption?.trim() || null,
    sortOrder: row.sortOrder,
    visibility: row.isPublished ? 'published' : 'draft',
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    route: {
      id: row.route.id,
      name: row.route.name,
      stravaUrl: row.route.stravaUrl?.trim() || null,
      stravaMapUrl: row.route.stravaMapUrl?.trim() || null,
      mapImageUrl: row.route.mapImageUrl?.trim() || null,
      distanceMiles: row.route.distanceMiles,
      routeNeighborhood: row.route.routeNeighborhood?.trim() || null,
      citySlug: row.route.citySlug?.trim() || null,
      createdByAthleteId: row.route.createdByAthleteId,
      contributorFirstName: row.route.createdBy.firstName?.trim() || null,
      contributorHandle: row.route.createdBy.gofastHandle?.trim() || null,
    },
  };
}

export async function listAthleteRunRoutesForOwner(
  athleteId: string
): Promise<AthleteRunRoutePayload[]> {
  const rows = await prisma.athlete_run_routes.findMany({
    where: { athleteId },
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    include: routeInclude,
  });
  return rows.map(mapAthleteRunRoute);
}

export async function listPublishedAthleteRunRoutes(
  athleteId: string,
  limit = 6
): Promise<AthleteRunRoutePayload[]> {
  const rows = await prisma.athlete_run_routes.findMany({
    where: { athleteId, isPublished: true },
    orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
    include: routeInclude,
  });
  return rows.map(mapAthleteRunRoute);
}

export function normalizeRunRouteInput(input: unknown): {
  routeId: string;
  caption: string | null;
  sortOrder: number;
  isPublished: boolean;
} {
  const value = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const routeId = String(value.routeId ?? '').trim();
  const captionRaw =
    value.caption === null || value.caption === undefined
      ? null
      : String(value.caption).trim() || null;
  const sortOrderRaw = Number(value.sortOrder ?? 0);
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.trunc(sortOrderRaw) : 0;
  const isPublished = Boolean(value.isPublished ?? value.visibility === 'published');

  return { routeId, caption: captionRaw, sortOrder, isPublished };
}
