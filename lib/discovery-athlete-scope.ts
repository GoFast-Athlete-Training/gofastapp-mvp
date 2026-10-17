import { discoveryScopeForAthleteCity } from '@/lib/region-slug';

type AthleteCityFields = {
  city: string | null;
  state: string | null;
};

export type DiscoveryLocationFromAthlete = {
  citySlug?: string;
  regionSlug?: string;
};

/** Server-side scope for GET /api/runs/discovery — ignores client query location. */
export function discoveryLocationFromAthlete(
  athlete: AthleteCityFields
): DiscoveryLocationFromAthlete | null {
  const scope = discoveryScopeForAthleteCity(athlete.city, athlete.state);
  if (!scope) return null;
  if ('regionSlug' in scope) {
    return { regionSlug: scope.regionSlug };
  }
  return { citySlug: scope.citySlug };
}
