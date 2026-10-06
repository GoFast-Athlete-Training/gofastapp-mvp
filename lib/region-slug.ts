import { toCitySlug } from '@/lib/seriesSlug';

/** Metro batch key for DC-area city slugs (matches seeded `regions.slug`). */
export const DMV_REGION_SLUG = 'dmv';

/** @deprecated Use DMV_REGION_SLUG */
export const DC_REGION_SLUG = DMV_REGION_SLUG;

const CITY_SLUG_TO_REGION: Record<string, string> = {
  dc: DMV_REGION_SLUG,
  arlington: DMV_REGION_SLUG,
  bethesda: DMV_REGION_SLUG,
  alexandria: DMV_REGION_SLUG,
};

const REGION_TO_CITY_SLUGS: Record<string, string[]> = {
  [DMV_REGION_SLUG]: ['dc', 'arlington', 'bethesda', 'alexandria'],
};

/** Sync fallback when city row is not loaded — aligned with seeded cities.regionId. */
export function inferRegionSlugFromCitySlug(
  citySlug: string | null | undefined
): string | null {
  const normalized = citySlug?.trim().toLowerCase();
  if (!normalized || normalized === 'unknown') return null;
  return CITY_SLUG_TO_REGION[normalized] ?? null;
}

/** Normalize athlete profile city (+ optional state) to the same citySlug used on city_runs. */
export function athleteCityToSlug(
  city: string | null | undefined,
  state?: string | null
): string {
  const trimmedCity = city?.trim();
  if (!trimmedCity) return 'unknown';
  const trimmedState = state?.trim();
  if (trimmedState) {
    const combined = toCitySlug(`${trimmedCity} ${trimmedState}`);
    if (combined !== 'unknown') return combined;
  }
  return toCitySlug(trimmedCity);
}

export function citySlugsForRegion(regionSlug: string | null | undefined): string[] {
  const region = regionSlug?.trim().toLowerCase();
  if (!region) return [];
  if (region === 'dc') {
    return REGION_TO_CITY_SLUGS[DMV_REGION_SLUG] ?? [];
  }
  return REGION_TO_CITY_SLUGS[region] ?? [];
}

export function isDmvRegionSlug(regionSlug: string | null | undefined): boolean {
  const r = regionSlug?.trim().toLowerCase();
  return r === DMV_REGION_SLUG || r === 'dc';
}
