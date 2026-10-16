import { prisma } from '@/lib/prisma';
import {
  cityRunMediaFromSavedRoute,
  resolveSavedRouteForAthlete,
} from '@/lib/city-run/saved-route-for-athlete';

export type AttachRouteResult =
  | { ok: true; routeId: string; routeName: string }
  | { ok: false; error: string; status: 400 | 403 | 404 };

/** Link a saved routes row to a city run and copy route media onto the run. */
export async function attachSavedRouteToCityRun(
  cityRunId: string,
  athleteId: string,
  routeId: string
): Promise<AttachRouteResult> {
  const id = cityRunId.trim();
  const rid = routeId.trim();
  if (!id || !rid) {
    return { ok: false, error: 'cityRunId and routeId are required', status: 400 };
  }

  const run = await prisma.city_runs.findUnique({
    where: { id },
    select: { id: true, athleteGeneratedId: true, totalMiles: true },
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

  const media = cityRunMediaFromSavedRoute(saved);

  await prisma.city_runs.update({
    where: { id },
    data: {
      routeId: media.routeId,
      stravaMapUrl: media.stravaMapUrl,
      mapImageUrl: media.mapImageUrl,
      routePhotos: media.routePhotos,
      routeNeighborhood: media.routeNeighborhood,
      runType: media.runType,
      ...(run.totalMiles == null && media.totalMiles != null
        ? { totalMiles: media.totalMiles }
        : {}),
      updatedAt: new Date(),
    },
  });

  return { ok: true, routeId: saved.id, routeName: saved.name };
}
