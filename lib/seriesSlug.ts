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

/** Normalize display / schedule text to gofast city code (dc, arlington, …). */
export function toCanonicalCity(raw: string | null | undefined): string {
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
  const city = slugifySegment(toCanonicalCity(cityRaw ?? ""));
  return `${club}-${day}-${city}`;
}
