import { athleteCityToSlug } from '@/lib/region-slug';

export type DiscoveryLocationParams = {
  citySlug?: string;
  regionSlug?: string;
  runClubSlug?: string;
};

export function parseDiscoveryLocationParams(
  searchParams: URLSearchParams
): DiscoveryLocationParams {
  const citySlug =
    searchParams.get('citySlug')?.trim() ||
    searchParams.get('gofastCity')?.trim() ||
    undefined;
  const regionSlug = searchParams.get('regionSlug')?.trim() || undefined;
  const runClubSlug = searchParams.get('runClubSlug')?.trim() || undefined;
  const athleteCity = searchParams.get('athleteCity')?.trim();
  const athleteState = searchParams.get('athleteState')?.trim() || undefined;

  let resolvedCitySlug = citySlug;
  if (!resolvedCitySlug && !regionSlug && athleteCity) {
    const normalized = athleteCityToSlug(athleteCity, athleteState);
    if (normalized !== 'unknown') {
      resolvedCitySlug = normalized;
    }
  }

  return {
    citySlug: resolvedCitySlug,
    regionSlug,
    runClubSlug,
  };
}

/** Go Run must always scope by city, region, or club — never unfiltered. */
export function hasDiscoveryLocationScope(params: DiscoveryLocationParams): boolean {
  if (params.runClubSlug) return true;
  if (params.regionSlug) return true;
  if (params.citySlug && params.citySlug !== 'unknown') return true;
  return false;
}
