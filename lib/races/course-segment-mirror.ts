/** Normalized segment shape for prod sync compare (content, not RM ids). */
export type CourseSegmentMirrorNorm = {
  order: number;
  name: string;
  mileMarker: string | null;
  description: string | null;
  runTip: string | null;
};

export function normSegmentFromPayloadItem(
  item: unknown
): CourseSegmentMirrorNorm | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const name =
    typeof o.name === "string" ? o.name.trim() : String(o.name ?? "").trim();
  if (!name) return null;
  const orderRaw = o.order;
  const order =
    typeof orderRaw === "number" && Number.isFinite(orderRaw)
      ? Math.round(orderRaw)
      : parseInt(String(orderRaw ?? 0), 10) || 0;
  const mileMarker =
    typeof o.mileMarker === "string" ? o.mileMarker.trim() || null : null;
  const description =
    typeof o.description === "string" ? o.description.trim() || null : null;
  const runTip =
    typeof o.runTip === "string" ? o.runTip.trim() || null : null;
  return { order, name, mileMarker, description, runTip };
}

export function normSegmentFromRegistryRow(row: {
  order: number;
  name: string;
  mileMarker: string | null;
  description: string | null;
  runTip: string | null;
}): CourseSegmentMirrorNorm {
  return {
    order: row.order,
    name: row.name.trim(),
    mileMarker: row.mileMarker?.trim() || null,
    description: row.description?.trim() || null,
    runTip: row.runTip?.trim() || null,
  };
}

export function courseSegmentsFingerprint(
  segments: CourseSegmentMirrorNorm[]
): string {
  const sorted = segments
    .slice()
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return JSON.stringify(sorted);
}

export function fingerprintFromPayloadCourseSegments(
  courseSegments: unknown
): { segmentCount: number; segmentFingerprint: string } {
  if (!Array.isArray(courseSegments)) {
    return { segmentCount: 0, segmentFingerprint: courseSegmentsFingerprint([]) };
  }
  const normalized: CourseSegmentMirrorNorm[] = [];
  for (const item of courseSegments) {
    const n = normSegmentFromPayloadItem(item);
    if (n) normalized.push(n);
  }
  normalized.sort((a, b) => a.order - b.order);
  return {
    segmentCount: normalized.length,
    segmentFingerprint: courseSegmentsFingerprint(normalized),
  };
}
