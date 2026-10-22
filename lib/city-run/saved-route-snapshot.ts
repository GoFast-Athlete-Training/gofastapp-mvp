import type { AthleteRunRoutePayload } from '@/lib/gofast-with-me/athlete-run-routes';

export type RouteCatalogRow = {
  id: string;
  name: string;
  stravaUrl?: string | null;
  stravaMapUrl?: string | null;
  mapImageUrl?: string | null;
  routePhotos?: unknown;
  routeNeighborhood?: string | null;
  routeDescription?: string | null;
  distanceMiles?: number | null;
  runType?: string | null;
};

export function snapshotFromRouteCatalogRow(row: RouteCatalogRow): SavedRouteSnapshot {
  const stravaMapUrl =
    row.stravaMapUrl?.trim() || row.stravaUrl?.trim() || null;
  const photos = Array.isArray(row.routePhotos)
    ? row.routePhotos.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    : [];

  return {
    routeId: row.id,
    name: row.name,
    stravaMapUrl,
    mapImageUrl: row.mapImageUrl?.trim() || null,
    routePhotos: photos,
    routeNeighborhood: row.routeNeighborhood?.trim() || null,
    routeDescription: row.routeDescription?.trim() || null,
    distanceMiles: row.distanceMiles ?? null,
    runType: row.runType?.trim() || null,
  };
}

/** Client-side snapshot when picking a saved routes catalog row for a city run. */
export type SavedRouteSnapshot = {
  routeId: string;
  name: string;
  stravaMapUrl: string | null;
  mapImageUrl: string | null;
  routePhotos: string[];
  routeNeighborhood: string | null;
  routeDescription: string | null;
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
    routeDescription: route.routeDescription?.trim() || null,
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
  setRouteNeighborhood?: (v: string) => void;
  setRouteDescription?: (v: string) => void;
  setMapImageUrl?: (v: string) => void;
  setTotalMiles?: (v: string) => void;
  setRoutePhotos?: (v: string[]) => void;
};

export type CityRunRouteFieldCurrent = {
  stravaMapUrl?: string;
  routeNeighborhood?: string;
  routeDescription?: string;
  mapImageUrl?: string;
  totalMiles?: string;
  routePhotos?: string[];
};

export function applySavedRouteToFormFields(
  snap: SavedRouteSnapshot,
  setters: CityRunRouteFieldSetters,
  current?: CityRunRouteFieldCurrent
): void {
  const onlyEmpty = Boolean(current);
  const stravaEmpty = !current?.stravaMapUrl?.trim();
  const neighborhoodEmpty = !current?.routeNeighborhood?.trim();
  const descriptionEmpty = !current?.routeDescription?.trim();
  const mapEmpty = !current?.mapImageUrl?.trim();
  const milesEmpty = !current?.totalMiles?.trim();
  const photosEmpty = !current?.routePhotos?.length;

  if (!onlyEmpty || stravaEmpty) {
    setters.setStravaMapUrl(snap.stravaMapUrl ?? '');
  }
  if (setters.setRouteDescription && (!onlyEmpty || descriptionEmpty)) {
    setters.setRouteDescription(snap.routeDescription ?? '');
  } else if (setters.setRouteNeighborhood && (!onlyEmpty || neighborhoodEmpty)) {
    setters.setRouteNeighborhood(snap.routeNeighborhood ?? '');
  }
  if (setters.setMapImageUrl && (!onlyEmpty || mapEmpty)) {
    setters.setMapImageUrl(snap.mapImageUrl ?? snap.routePhotos[0] ?? '');
  }
  const miles = formatMilesForInput(snap.distanceMiles);
  if (miles && setters.setTotalMiles && (!onlyEmpty || milesEmpty)) {
    setters.setTotalMiles(miles);
  }
  if (setters.setRoutePhotos && (!onlyEmpty || photosEmpty)) {
    setters.setRoutePhotos(snap.routePhotos);
  }
}

export function clearSavedRouteFormFields(setters: CityRunRouteFieldSetters): void {
  setters.setStravaMapUrl('');
  setters.setRouteDescription?.('');
  setters.setRouteNeighborhood?.('');
  setters.setMapImageUrl?.('');
}
