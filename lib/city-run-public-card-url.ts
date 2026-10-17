/**
 * Company run link slice on gofastlinks — narrow card for link trees (all CityRunType values).
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

/** @deprecated Use companyRunLinkSliceUrl — legacy dcruns /runs/{slug}/card path retired. */
export function cityRunPublicCardUrl(
  runSlugOrId: string,
  _citySlug?: string | null,
  _runId?: string,
): string {
  return companyRunLinkSliceUrl(runSlugOrId);
}
