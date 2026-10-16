export type NeighborhoodAuthority = 'auto' | 'cityRun' | 'route';

function norm(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

export type NeighborhoodAttachResolution =
  | {
      ok: true;
      canonical: string | null;
      /** Patch routes.routeNeighborhood before attach */
      updateRouteNeighborhood: string | null;
      /** Patch city_runs.routeNeighborhood before attach (when route wins) */
      updateCityRunNeighborhood: string | null;
    }
  | {
      ok: false;
      conflict: true;
      cityRunNeighborhood: string;
      routeNeighborhood: string;
    };

export function resolveNeighborhoodForAttach(
  cityRunNeighborhood: string | null | undefined,
  routeNeighborhood: string | null | undefined,
  authority: NeighborhoodAuthority = 'auto'
): NeighborhoodAttachResolution {
  const runN = norm(cityRunNeighborhood);
  const routeN = norm(routeNeighborhood);

  if (!runN && !routeN) {
    return {
      ok: true,
      canonical: null,
      updateRouteNeighborhood: null,
      updateCityRunNeighborhood: null,
    };
  }

  if (runN === routeN) {
    return {
      ok: true,
      canonical: runN,
      updateRouteNeighborhood: null,
      updateCityRunNeighborhood: null,
    };
  }

  if (!runN && routeN) {
    return {
      ok: true,
      canonical: routeN,
      updateRouteNeighborhood: null,
      updateCityRunNeighborhood: routeN,
    };
  }

  if (runN && !routeN) {
    return {
      ok: true,
      canonical: runN,
      updateRouteNeighborhood: runN,
      updateCityRunNeighborhood: null,
    };
  }

  // Both set and different
  if (authority === 'cityRun') {
    return {
      ok: true,
      canonical: runN,
      updateRouteNeighborhood: runN,
      updateCityRunNeighborhood: null,
    };
  }
  if (authority === 'route') {
    return {
      ok: true,
      canonical: routeN,
      updateRouteNeighborhood: null,
      updateCityRunNeighborhood: routeN,
    };
  }

  return {
    ok: false,
    conflict: true,
    cityRunNeighborhood: runN!,
    routeNeighborhood: routeN!,
  };
}
