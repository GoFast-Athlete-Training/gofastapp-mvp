/**
 * Run series slug: {clubSlug}-{day}-{canonicalCity} — mirrors GoFastCompany lib/acqRunSeries.ts.
 * Keep in sync when changing slug rules.
 */

export function slugifySegment(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Map city text to gofast city slug (dc, arlington, …). Keep in sync with GoFastCompany lib/acqRunSeries.ts */
export function toCitySlug(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) return "unknown";
  const norm = String(raw)
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ");

  const aliases: Record<string, string> = {
    dc: "dc",
    dcc: "dc",
    "washington dc": "dc",
    washington: "dc",
    "washington d c": "dc",
    "d c": "dc",
    "district of columbia": "dc",
    arlington: "arlington",
    "arlington va": "arlington",
    alexandria: "alexandria",
    "alexandria va": "alexandria",
    bethesda: "bethesda",
    "bethesda md": "bethesda",
    silver: "silver-spring",
    "silver spring": "silver-spring",
    "silver spring md": "silver-spring",
  };

  return aliases[norm] ?? (slugifySegment(raw) || "unknown");
}

/** @deprecated Use toCitySlug */
export const toCanonicalCity = toCitySlug;

/**
 * Pattern: {clubSlug}-{canonicalDay lower}-{canonicalCity slug}.
 * City segment is required (use "unknown" if missing).
 */
export function buildSeriesSlug(
  clubSlug: string,
  canonicalDayUpper: string,
  cityRaw: string | null | undefined
): string {
  const club = slugifySegment(clubSlug || "club") || "club";
  const day = canonicalDayUpper.toLowerCase();
  const city = slugifySegment(toCitySlug(cityRaw ?? ""));
  return `${club}-${day}-${city}`;
}
