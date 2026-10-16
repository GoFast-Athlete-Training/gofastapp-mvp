import { Prisma } from "@prisma/client";
import type { CityRunRouteMediaFromSavedRoute } from "@/lib/city-run/saved-route-for-athlete";

function normalizePhotoUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
}

export type AthleteRouteMediaBody = {
  stravaMapUrl?: string | null;
  mapImageUrl?: string | null;
  routeNeighborhood?: string | null;
  routePhotos?: string[] | null;
  totalMiles?: number | null;
};

export type MergedCityRunRouteMedia = {
  stravaMapUrl: string | null;
  mapImageUrl: string | null;
  routeNeighborhood: string | null;
  routePhotos: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  routeId: string | null;
  runType: string | null;
};

/** Athlete-entered media wins; saved route fills only empty fields. */
export function mergeCityRunRouteMedia(
  body: AthleteRouteMediaBody,
  saved: CityRunRouteMediaFromSavedRoute | null
): MergedCityRunRouteMedia {
  const athleteStrava = body.stravaMapUrl?.trim() || null;
  const athleteMap = body.mapImageUrl?.trim() || null;
  const athleteNeighborhood = body.routeNeighborhood?.trim() || null;
  const athletePhotos = normalizePhotoUrls(body.routePhotos);

  return {
    stravaMapUrl: athleteStrava ?? saved?.stravaMapUrl ?? null,
    mapImageUrl: athleteMap ?? saved?.mapImageUrl ?? null,
    routeNeighborhood: athleteNeighborhood ?? saved?.routeNeighborhood ?? null,
    routePhotos: (() => {
      if (athletePhotos.length > 0) return athletePhotos;
      const savedRaw = saved?.routePhotos;
      if (savedRaw && savedRaw !== Prisma.JsonNull && Array.isArray(savedRaw)) {
        const fromSaved = normalizePhotoUrls(savedRaw);
        if (fromSaved.length > 0) return fromSaved;
      }
      return Prisma.JsonNull;
    })(),
    routeId: saved?.routeId ?? null,
    runType: saved?.runType ?? null,
  };
}

export function mergeTotalMiles(
  bodyMiles: number | null | undefined,
  savedMiles: number | null | undefined,
  workoutMiles: number | null
): number | null {
  if (bodyMiles != null && Number.isFinite(bodyMiles) && bodyMiles > 0) {
    return bodyMiles;
  }
  if (savedMiles != null && Number.isFinite(savedMiles) && savedMiles > 0) {
    return savedMiles;
  }
  return workoutMiles;
}
