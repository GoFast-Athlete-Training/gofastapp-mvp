import { getPublicRunDetailPageUrl } from "@/lib/public-run-detail-url";

/**
 * gofastlinks /run/{slug} — narrow card kept for legacy bookmarks only.
 * Do not use for new share links; use getPublicRunDetailPageUrl instead.
 * @see gofast-contentpublic app/run/[slug]
 */
export function companyRunLinkSliceUrl(runSlugOrId: string): string {
  const key = runSlugOrId.trim();
  const base = (
    process.env.NEXT_PUBLIC_GOFAST_LINKS_URL ||
    process.env.GOFAST_LINKS_URL ||
    "https://gofastlinks.gofastcrushgoals.com"
  ).replace(/\/$/, "");
  return `${base}/run/${encodeURIComponent(key)}`;
}

/** Share + link-tree CITY_RUN read URL (dcruns / Pulse typed detail). */
export function cityRunPublicCardUrl(
  runSlugOrId: string,
  _citySlug?: string | null,
  runId?: string,
  cityRunType?: string | null,
  runClubSlug?: string | null,
): string {
  const slug = runSlugOrId.trim();
  return getPublicRunDetailPageUrl({
    id: runId?.trim() || slug,
    slug,
    cityRunType,
    runClub: runClubSlug?.trim() ? { slug: runClubSlug.trim() } : null,
  });
}
