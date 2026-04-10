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
