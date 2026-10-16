import { prisma } from '@/lib/prisma';
import {
  cityRunMediaFromSavedRoute,
  resolveSavedRouteForAthlete,
} from '@/lib/city-run/saved-route-for-athlete';
import {
  resolveNeighborhoodForAttach,
  type NeighborhoodAuthority,
} from '@/lib/city-run/resolve-route-neighborhood-on-attach';

export type AttachRouteResult =
  | { ok: true; routeId: string; routeName: string }
  | {
      ok: false;
      error: string;
      status: 400 | 403 | 404 | 409;
      conflict?: boolean;
      cityRunNeighborhood?: string;
      routeNeighborhood?: string;
    };

/** Link a saved routes row to a city run and copy route media onto the run. */
export async function attachSavedRouteToCityRun(
  cityRunId: string,
  athleteId: string,
  routeId: string,
  neighborhoodAuthority: NeighborhoodAuthority = 'auto'
): Promise<AttachRouteResult> {
  const id = cityRunId.trim();
  const rid = routeId.trim();
  if (!id || !rid) {
    return { ok: false, error: 'cityRunId and routeId are required', status: 400 };
  }

  const run = await prisma.city_runs.findUnique({
    where: { id },
    select: {
      id: true,
      athleteGeneratedId: true,
      totalMiles: true,
      routeNeighborhood: true,
      workoutDescription: true,
    },
  });
  if (!run) {
    return { ok: false, error: 'Run not found', status: 404 };
  }
  if (run.athleteGeneratedId !== athleteId) {
    return { ok: false, error: 'You can only attach routes to runs you host', status: 403 };
  }

  const saved = await resolveSavedRouteForAthlete(athleteId, rid);
  if (!saved) {
    return { ok: false, error: 'Route not found or not in your saved routes', status: 404 };
  }

  const neighborhood = resolveNeighborhoodForAttach(
    run.routeNeighborhood,
    saved.routeNeighborhood,
    neighborhoodAuthority
  );

  if (!neighborhood.ok) {
    return {
      ok: false,
      error: 'Route neighborhood does not match this run — choose which one to keep.',
      status: 409,
      conflict: true,
      cityRunNeighborhood: neighborhood.cityRunNeighborhood,
      routeNeighborhood: neighborhood.routeNeighborhood,
    };
  }

  if (neighborhood.updateRouteNeighborhood) {
    await prisma.routes.update({
      where: { id: rid },
      data: { routeNeighborhood: neighborhood.updateRouteNeighborhood, updatedAt: new Date() },
    });
  }

  const media = cityRunMediaFromSavedRoute({
    ...saved,
    routeNeighborhood:
      neighborhood.updateRouteNeighborhood ?? saved.routeNeighborhood ?? neighborhood.canonical,
  });

  const cityRunNeighborhoodFinal =
    neighborhood.updateCityRunNeighborhood ?? neighborhood.canonical ?? media.routeNeighborhood;

  const routeDescription = saved.routeDescription?.trim() || null;
  const workoutDescription =
    routeDescription && !run.workoutDescription?.trim()
      ? routeDescription
      : run.workoutDescription?.trim() || routeDescription;

  await prisma.city_runs.update({
    where: { id },
    data: {
      routeId: media.routeId,
      stravaMapUrl: media.stravaMapUrl,
      mapImageUrl: media.mapImageUrl,
      routePhotos: media.routePhotos,
      routeNeighborhood: cityRunNeighborhoodFinal,
      runType: media.runType,
      ...(workoutDescription ? { workoutDescription } : {}),
      ...(run.totalMiles == null && media.totalMiles != null
        ? { totalMiles: media.totalMiles }
        : {}),
      updatedAt: new Date(),
    },
  });

  return { ok: true, routeId: saved.id, routeName: saved.name };
}
