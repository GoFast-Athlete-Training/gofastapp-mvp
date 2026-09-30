/** Client-safe route AI source check (no OpenAI imports). */

export type RouteDetailsInput = {
  mapImageUrl?: string | null;
  directionsText?: string | null;
  routeNotes?: string | null;
  routeNeighborhood?: string | null;
  stravaMapUrl?: string | null;
  totalMiles?: string | number | null;
  meetUpPoint?: string | null;
};

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}

/**
 * Route AI requires a map image, pasted directions, or an existing route path to refine.
 * routeNeighborhood alone is not enough — it is context only.
 */
export function hasRouteDetailsSource(input: RouteDetailsInput): boolean {
  const evidence = [input.mapImageUrl, input.directionsText, input.routeNotes];
  return evidence.some((v) => str(v) !== "");
}
