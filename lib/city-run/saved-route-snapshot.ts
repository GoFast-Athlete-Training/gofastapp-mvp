import type { AthleteRunRoutePayload } from '@/lib/gofast-with-me/athlete-run-routes';

/** Client-side snapshot when picking a My Routes row for a city run. */
export type SavedRouteSnapshot = {
  routeId: string;
  name: string;
  stravaMapUrl: string | null;
  mapImageUrl: string | null;
  routePhotos: string[];
  routeNeighborhood: string | null;
  distanceMiles: number | null;
  runType: string | null;
};

export function snapshotFromAthleteRunRoute(row: AthleteRunRoutePayload): SavedRouteSnapshot {
  const route = row.route;
  const stravaMapUrl =
    route.stravaMapUrl?.trim() || route.stravaUrl?.trim() || null;
  const photos = Array.isArray(route.routePhotos)
    ? route.routePhotos.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    : [];

  return {
    routeId: row.routeId,
    name: route.name,
    stravaMapUrl,
    mapImageUrl: route.mapImageUrl?.trim() || null,
    routePhotos: photos,
    routeNeighborhood: route.routeNeighborhood?.trim() || null,
    distanceMiles: route.distanceMiles,
    runType: route.runType?.trim() || null,
  };
}

export function formatMilesForInput(miles: number | null | undefined): string {
  if (miles == null || !Number.isFinite(miles) || miles <= 0) return '';
  const rounded = Math.round(miles * 10) / 10;
  return rounded % 1 === 0 ? String(rounded.toFixed(0)) : String(rounded);
}

export type CityRunRouteFieldSetters = {
  setStravaMapUrl: (v: string) => void;
  setRouteNeighborhood: (v: string) => void;
  setMapImageUrl?: (v: string) => void;
  setTotalMiles?: (v: string) => void;
};

export function applySavedRouteToFormFields(
  snap: SavedRouteSnapshot,
  setters: CityRunRouteFieldSetters
): void {
  setters.setStravaMapUrl(snap.stravaMapUrl ?? '');
  setters.setRouteNeighborhood(snap.routeNeighborhood ?? '');
  setters.setMapImageUrl?.(snap.mapImageUrl ?? snap.routePhotos[0] ?? '');
  const miles = formatMilesForInput(snap.distanceMiles);
  if (miles && setters.setTotalMiles) setters.setTotalMiles(miles);
}

export function clearSavedRouteFormFields(setters: CityRunRouteFieldSetters): void {
  setters.setStravaMapUrl('');
  setters.setRouteNeighborhood('');
  setters.setMapImageUrl?.('');
}
