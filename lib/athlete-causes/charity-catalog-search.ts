/** Normalized charity pick row for Links + Causes search (catalog-first; legacy registry optional). */
export type AthleteCharityCatalogHit = {
  charityId: string;
  charityName: string;
  charityUrl: string;
  charityLogo: string | null;
  athleteCauseId: string | null;
  /** Legacy race_registry snap path (older API responses). */
  raceRegistryId?: string | null;
};

export function normalizeAthleteCharityCatalogHit(raw: unknown): AthleteCharityCatalogHit | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const charityName = typeof row.charityName === "string" ? row.charityName.trim() : "";
  const charityUrl = typeof row.charityUrl === "string" ? row.charityUrl.trim() : "";
  if (!charityName || !charityUrl) return null;

  const charityId =
    typeof row.charityId === "string" && row.charityId.trim()
      ? row.charityId.trim()
      : typeof row.raceRegistryId === "string" && row.raceRegistryId.trim()
        ? row.raceRegistryId.trim()
        : null;
  if (!charityId) return null;

  return {
    charityId,
    charityName,
    charityUrl,
    charityLogo: typeof row.charityLogo === "string" ? row.charityLogo.trim() || null : null,
    athleteCauseId:
      typeof row.athleteCauseId === "string" && row.athleteCauseId.trim()
        ? row.athleteCauseId.trim()
        : null,
    raceRegistryId:
      typeof row.raceRegistryId === "string" && row.raceRegistryId.trim()
        ? row.raceRegistryId.trim()
        : null,
  };
}

export function normalizeAthleteCharityCatalogHits(raw: unknown): AthleteCharityCatalogHit[] {
  if (!Array.isArray(raw)) return [];
  const out: AthleteCharityCatalogHit[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const hit = normalizeAthleteCharityCatalogHit(item);
    if (!hit) continue;
    const dedupe = `${hit.charityId}|${hit.charityUrl.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(hit);
  }
  return out;
}
