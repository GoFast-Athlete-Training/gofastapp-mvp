import { toCitySlug } from '@/lib/seriesSlug';

/** citySlug → regionSlug when a suburb/metro should reel into a region button. */
const CITY_SLUG_TO_REGION: Record<string, string> = {
  dc: 'dc',
  arlington: 'dc',
  bethesda: 'dc',
  alexandria: 'dc',
};

export const DC_REGION_SLUG = 'dc';

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
  return Object.entries(CITY_SLUG_TO_REGION)
    .filter(([, r]) => r === region)
    .map(([city]) => city);
}
