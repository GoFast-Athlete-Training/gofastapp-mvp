import { getPublicRunDetailPageUrl } from '@/lib/public-run-detail-url';
import { athletePublicRouteSliceAppPath } from '@/lib/gofast-with-me/athlete-community-routes';
import { runnerPublicRouteSliceUrl } from '@/lib/gofast-with-me/runner-public-url';

/** Public run read URL (content directory / Pulse — not gofastlinks). */
export function cityRunDoorUrl(
  slugOrId: string,
  cityRunType?: string | null,
): string {
  const key = slugOrId.trim();
  return getPublicRunDetailPageUrl({ id: key, slug: key, cityRunType: cityRunType ?? 'INDIVIDUAL' });
}

/** GoFast signup + RSVP lane for a city run. */
export function cityRunJoinPath(slugOrId: string): string {
  return `/join/run/${encodeURIComponent(slugOrId)}`;
}

export function cityRunJoinSignupPath(
  slugOrId: string,
  returnTo?: string,
): string {
  const base = `/join/run/${encodeURIComponent(slugOrId)}/signup`;
  if (!returnTo?.trim()) return base;
  return `${base}?returnTo=${encodeURIComponent(returnTo.trim())}`;
}

/** @deprecated Prefer cityRunJoinPath — legacy alias. */
export function runRsvpPath(slugOrId: string): string {
  return cityRunJoinPath(slugOrId);
}

/** Member run together surface (people, chatter) after GoFast join. */
export function cityRunTogetherPath(slugOrId: string): string {
  return `/cityruntogether/${encodeURIComponent(slugOrId)}`;
}

/**
 * In-app route slice for a saved route row.
 * Prefer `cityRunRouteSlicePathForCreator` when you know the host handle.
 * Segment is always routes.id today (routes.slug later).
 */
export function cityRunRouteSlicePath(
  routeId: string,
  opts?: { from?: string; creatorHandle?: string | null },
): string {
  const id = routeId.trim();
  const from = opts?.from?.trim();
  const handle = opts?.creatorHandle?.trim();
  if (handle) {
    return athletePublicRouteSliceAppPath(handle, id, { from });
  }
  const base = `/routes/${encodeURIComponent(id)}`;
  if (!from || !from.startsWith('/') || from.startsWith('//')) return base;
  return `${base}?from=${encodeURIComponent(from)}`;
}

/** Stranger-facing route slice on runner host (`{slug}/routes/{routeId}`). */
export function cityRunRouteSlicePublicUrl(
  creatorHandle: string,
  routeId: string,
): string {
  return runnerPublicRouteSliceUrl(creatorHandle, routeId);
}

export const CITY_RUN_JOINED_SESSION_KEY = 'gofast:city-run-joined';

export function markCityRunJoinedBanner(runId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(`${CITY_RUN_JOINED_SESSION_KEY}:${runId}`, '1');
}

export function consumeCityRunJoinedBanner(runId: string): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  const key = `${CITY_RUN_JOINED_SESSION_KEY}:${runId}`;
  if (sessionStorage.getItem(key) !== '1') return false;
  sessionStorage.removeItem(key);
  return true;
}

/** @deprecated Join lane lands on hub with session banner instead. */
export function cityRunRsvpSuccessQuery(): string {
  return 'rsvp=success';
}

/** Post-run recap — planned workout head + photos / shouts (not the run hub). */
export function runCompletePath(slugOrId: string): string {
  return `/runcomplete/${encodeURIComponent(slugOrId)}`;
}
