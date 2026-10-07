export const ATHLETE_LINKS_PUBLIC_BASE =
  process.env.NEXT_PUBLIC_ATHLETE_LINKS_URL?.trim() ||
  "https://athletelinks.gofastcrushgoals.com";

export function athleteLinksPublicUrl(handle: string): string {
  const slug = handle.trim().replace(/^@+/, "").toLowerCase();
  const base = ATHLETE_LINKS_PUBLIC_BASE.replace(/\/$/, "");
  return `${base}/${encodeURIComponent(slug)}`;
}
