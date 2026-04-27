export const runTypeCatalogueSelect = {
  id: true,
  name: true,
  workoutType: true,
  slug: true,
} as const;

export type RunTypePositionInput = {
  cyclePosition: number;
  distributionWeight: number;
  catalogueWorkoutId: string | null;
};

export function parseRunTypePositionsBody(
  raw: unknown
): { ok: true; rows: RunTypePositionInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "Body must be a non-empty array" };
  }
  const rows: RunTypePositionInput[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;
    if (item == null || typeof item !== "object") {
      return { ok: false, error: `Invalid item at index ${i}` };
    }
    const cp = item.cyclePosition;
    if (typeof cp !== "number" || !Number.isInteger(cp) || cp < 0) {
      return { ok: false, error: `cyclePosition must be a non-negative integer (index ${i})` };
    }
    if (seen.has(cp)) {
      return { ok: false, error: `Duplicate cyclePosition ${cp}` };
    }
    seen.add(cp);
    const dw = item.distributionWeight;
    if (typeof dw !== "number" || !Number.isFinite(dw) || dw < 0) {
      return { ok: false, error: `distributionWeight must be a non-negative number (index ${i})` };
    }
    let catalogueWorkoutId: string | null = null;
    if (Object.prototype.hasOwnProperty.call(item, "catalogueWorkoutId")) {
      if (item.catalogueWorkoutId === null || item.catalogueWorkoutId === undefined || item.catalogueWorkoutId === "") {
        catalogueWorkoutId = null;
      } else if (typeof item.catalogueWorkoutId === "string") {
        catalogueWorkoutId = item.catalogueWorkoutId;
      } else {
        return { ok: false, error: `catalogueWorkoutId must be a string or null (index ${i})` };
      }
    }
    rows.push({ cyclePosition: cp, distributionWeight: dw, catalogueWorkoutId });
  }
  const sum = rows.reduce((a, r) => a + r.distributionWeight, 0);
  if (sum <= 0 || !Number.isFinite(sum)) {
    return { ok: false, error: "distributionWeight values must have a positive sum" };
  }
  return { ok: true, rows };
}
