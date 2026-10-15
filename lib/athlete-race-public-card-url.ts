/** Public athlete race card on the races content host: /race/{raceSlug}/{handle}. */
export function athleteRacePublicCardUrl(raceSlug: string, handle: string): string {
  const slug = raceSlug.trim().toLowerCase();
  const h = handle.trim().replace(/^@+/, "").toLowerCase();
  const base =
    process.env.NEXT_PUBLIC_CONTENT_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_CONTENT_SITE_URL?.replace(/\/$/, "") ||
    "https://races.gofastcrushgoals.com";
  return `${base}/race/${encodeURIComponent(slug)}/${encodeURIComponent(h)}`;
}
