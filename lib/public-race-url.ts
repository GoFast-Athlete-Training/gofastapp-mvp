/**
 * Canonical public race viewer URL (gofast-contentpublic), matching GoFastCompany
 * dashboard: NEXT_PUBLIC_CONTENT_PUBLIC_URL + /race/[slug].
 */
export function getPublicRacePageUrl(slug: string | null | undefined): string | null {
  const s = slug?.trim();
  if (!s) return null;
  const base =
    process.env.NEXT_PUBLIC_CONTENT_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_CONTENT_SITE_URL?.replace(/\/$/, "") ||
    "https://races.gofastcrushgoals.com";
  return `${base}/race/${encodeURIComponent(s)}`;
}

/**
 * Standalone public course page (gofast-contentpublic) — /course/[slug].
 * Uses same base URL as race pages; courseSlug comes from Company race_courses.slug via prodpush.
 */
/** Race-scoped course overview on the content site — /race/{slug}/course */
export function getPublicRaceCourseUrl(raceSlug: string | null | undefined): string | null {
  const s = raceSlug?.trim();
  if (!s) return null;
  const base =
    process.env.NEXT_PUBLIC_CONTENT_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_CONTENT_SITE_URL?.replace(/\/$/, "") ||
    "https://races.gofastcrushgoals.com";
  return `${base}/race/${encodeURIComponent(s)}/course`;
}

/** @deprecated Use getPublicRaceCourseUrl */
export function getRacePrepCourseUrl(raceSlug: string | null | undefined): string | null {
  return getPublicRaceCourseUrl(raceSlug);
}

/** Getting to the Start slice on the content site. */
export function getRaceGettingToStartUrl(raceSlug: string | null | undefined): string | null {
  const s = raceSlug?.trim();
  if (!s) return null;
  const base =
    process.env.NEXT_PUBLIC_CONTENT_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_CONTENT_SITE_URL?.replace(/\/$/, "") ||
    "https://races.gofastcrushgoals.com";
  return `${base}/race/${encodeURIComponent(s)}/getting-to-the-start`;
}

export function getPublicCoursePageUrl(
  courseSlug: string | null | undefined
): string | null {
  const s = courseSlug?.trim();
  if (!s) return null;
  const base =
    process.env.NEXT_PUBLIC_CONTENT_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_CONTENT_SITE_URL?.replace(/\/$/, "") ||
    "https://races.gofastcrushgoals.com";
  return `${base}/course/${encodeURIComponent(s)}`;
}
