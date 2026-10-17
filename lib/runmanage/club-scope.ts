import {
  DMV_REGION_SLUG,
  athleteCityToSlug,
  inferRegionSlugFromCitySlug,
} from "@/lib/region-slug";

export type ClubScopeKey = string;

export type ClubScopeOption = {
  key: ClubScopeKey;
  label: string;
  kind: "region" | "city";
};

export type ClubForScope = {
  citySlug?: string | null;
  city?: string | null;
  state?: string | null;
};

export function resolveClubCitySlug(club: ClubForScope): string {
  const slug = club.citySlug?.trim().toLowerCase();
  if (slug && slug !== "unknown") return slug;
  return athleteCityToSlug(club.city, club.state);
}

export function clubScopeKeyForClub(club: ClubForScope): ClubScopeKey {
  const citySlug = resolveClubCitySlug(club);
  const region = inferRegionSlugFromCitySlug(citySlug);
  if (region) return `region:${region}`;
  return `city:${citySlug}`;
}

export function scopeLabelForKey(key: ClubScopeKey): string {
  if (key.startsWith("region:")) {
    const slug = key.slice("region:".length);
    if (slug === DMV_REGION_SLUG) return "DMV";
    return slug.toUpperCase();
  }
  if (key.startsWith("city:")) {
    const slug = key.slice("city:".length);
    return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return key;
}

export function buildClubScopeOptions(clubs: ClubForScope[]): ClubScopeOption[] {
  const keys = new Set<ClubScopeKey>();
  for (const club of clubs) {
    keys.add(clubScopeKeyForClub(club));
  }
  return [...keys]
    .map((key) => ({
      key,
      label: scopeLabelForKey(key),
      kind: key.startsWith("region:") ? ("region" as const) : ("city" as const),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function clubMatchesScope(club: ClubForScope, scopeKey: ClubScopeKey): boolean {
  return clubScopeKeyForClub(club) === scopeKey;
}
