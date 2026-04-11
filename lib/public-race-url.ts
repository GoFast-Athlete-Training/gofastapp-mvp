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
