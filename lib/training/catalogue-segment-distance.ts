import { metersToMiles } from "@/lib/pace-utils";

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export type CatalogueSegmentDistanceRow = {
  miles?: unknown;
  distanceMeters?: unknown;
};

/**
 * Resolve catalogue segment distance to miles for materialization.
 * Accepts explicit miles or interval-style distanceMeters (Tempo historically missed the latter).
 */
export function catalogueSegmentDistanceMiles(
  row: CatalogueSegmentDistanceRow
): number | null {
  if (row.miles != null && row.miles !== "") {
    const m = Number(row.miles);
    if (Number.isFinite(m) && m > 0) return round(m, 4);
  }
  if (row.distanceMeters != null && row.distanceMeters !== "") {
    const dm = Number(row.distanceMeters);
    if (Number.isFinite(dm) && dm > 0) return round(metersToMiles(dm), 3);
  }
  return null;
}

/** True when JSON array rows carry miles and/or distanceMeters (Tempo mile list). */
export function isTempoWorkSegmentList(v: unknown): v is Array<
  CatalogueSegmentDistanceRow & {
    paceOffsetSecPerMile?: number | null;
    paceKey?: string | null;
    reps?: number;
  }
> {
  if (!Array.isArray(v) || v.length === 0) return false;
  for (const row of v) {
    if (row == null || typeof row !== "object" || Array.isArray(row)) return false;
    if (catalogueSegmentDistanceMiles(row as CatalogueSegmentDistanceRow) == null) {
      return false;
    }
  }
  return true;
}

/** segmentPaceDist uses distanceMeters on any segment row (interval-style authoring). */
export function segmentPaceDistUsesDistanceMeters(segmentPaceDist: unknown): boolean {
  const rows: unknown[] = [];
  if (Array.isArray(segmentPaceDist)) {
    rows.push(...segmentPaceDist);
  } else if (
    segmentPaceDist != null &&
    typeof segmentPaceDist === "object" &&
    !Array.isArray(segmentPaceDist)
  ) {
    const segs = (segmentPaceDist as { segments?: unknown }).segments;
    if (Array.isArray(segs)) rows.push(...segs);
  }
  return rows.some(
    (row) =>
      row != null &&
      typeof row === "object" &&
      "distanceMeters" in (row as object) &&
      Number((row as { distanceMeters?: unknown }).distanceMeters) > 0
  );
}
