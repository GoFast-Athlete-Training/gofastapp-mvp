/** Public narrow run card on the races/content host: /runs/{slugOrId}/card */
export function cityRunPublicCardUrl(runSlugOrId: string): string {
  const key = runSlugOrId.trim();
  const base =
    process.env.NEXT_PUBLIC_CONTENT_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_CONTENT_SITE_URL?.replace(/\/$/, "") ||
    "https://races.gofastcrushgoals.com";
  return `${base}/runs/${encodeURIComponent(key)}/card`;
}
