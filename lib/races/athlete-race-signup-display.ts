/** Home / nav helpers — athlete_races snapshot is the race-date source of truth. */

export type SignupWithClaimDate = {
  raceDate?: string | Date | null;
  slug?: string | null;
  name?: string | null;
  distanceLabel?: string | null;
  race_registry?: {
    id?: string;
    raceDate?: string | null;
    slug?: string | null;
    name?: string | null;
    distanceLabel?: string | null;
  } | null;
};

export function signupClaimRaceDateIso(signup: SignupWithClaimDate): string | null {
  const raw = signup.raceDate ?? signup.race_registry?.raceDate;
  if (raw == null) return null;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString();
  }
  return null;
}

export function signupDisplayName(signup: SignupWithClaimDate): string {
  return (
    signup.name?.trim() ||
    signup.race_registry?.name?.trim() ||
    "Your race"
  );
}

export function signupDisplaySlug(signup: SignupWithClaimDate): string | null {
  const s = signup.slug ?? signup.race_registry?.slug;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

export function signupRegistryId(signup: SignupWithClaimDate): string | null {
  return signup.race_registry?.id?.trim() || null;
}

/** Personal race page with splits planner expanded (web). */
export function myRacePlannerHref(
  slug: string | null | undefined,
  raceRegistryId: string
): string {
  if (slug?.trim()) return `/myrace/${encodeURIComponent(slug.trim())}?plan=1`;
  return `/race-hub/${raceRegistryId}`;
}

export function myRacePageHref(
  slug: string | null | undefined,
  raceRegistryId: string
): string {
  if (slug?.trim()) return `/myrace/${encodeURIComponent(slug.trim())}`;
  return `/race-hub/${raceRegistryId}`;
}
