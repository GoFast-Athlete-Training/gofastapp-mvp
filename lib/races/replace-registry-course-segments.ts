import { normSegmentFromPayloadItem } from "@/lib/races/course-segment-mirror";
import { prisma } from "@/lib/prisma";

export type ParsedRegistryCourseSegment = {
  order: number;
  name: string;
  mileMarker: string | null;
  description: string | null;
  runTip: string | null;
  guideLandmarks: string | null;
  guideWater: string | null;
  guideElevation: string | null;
  sourceSegmentId: string | null;
};

function optionalSourceSegmentId(o: Record<string, unknown>): string | null {
  const id =
    (typeof o.sourceSegmentId === "string" && o.sourceSegmentId.trim()) ||
    (typeof o.companySegmentId === "string" && o.companySegmentId.trim()) ||
    (typeof o.id === "string" && o.id.trim()) ||
    "";
  return id || null;
}

export function parseRegistryCourseSegmentsFromWire(
  segments: unknown[]
): ParsedRegistryCourseSegment[] {
  const out: ParsedRegistryCourseSegment[] = [];
  for (const item of segments) {
    const norm = normSegmentFromPayloadItem(item);
    if (!norm) continue;
    const o = item as Record<string, unknown>;
    out.push({
      ...norm,
      guideLandmarks:
        typeof o.guideLandmarks === "string"
          ? o.guideLandmarks.trim() || null
          : null,
      guideWater:
        typeof o.guideWater === "string" ? o.guideWater.trim() || null : null,
      guideElevation:
        typeof o.guideElevation === "string"
          ? o.guideElevation.trim() || null
          : null,
      sourceSegmentId: optionalSourceSegmentId(o),
    });
  }
  out.sort((a, b) => a.order - b.order);
  return out;
}

export function courseSegmentsArrayFromPayload(
  racePayload: Record<string, unknown>
): unknown[] | null {
  if (!("courseSegments" in racePayload)) return null;
  let segments: unknown = racePayload.courseSegments;
  if (typeof segments === "string" && segments.trim()) {
    try {
      segments = JSON.parse(segments);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(segments)) return [];
  return segments;
}

/**
 * Full replace for one registry row (city_runs-style). Key present including [] wipes prod segments.
 * Returns -1 when courseSegments key omitted (leave existing rows unchanged).
 */
export async function replaceRegistryCourseSegments(
  raceRegistryId: string,
  racePayload: Record<string, unknown>
): Promise<number> {
  const segments = courseSegmentsArrayFromPayload(racePayload);
  if (segments === null) return -1;

  const rows = parseRegistryCourseSegmentsFromWire(segments);

  await prisma.$transaction(async (tx) => {
    await tx.race_registry_course_segments.deleteMany({
      where: { raceRegistryId },
    });
    for (const row of rows) {
      await tx.race_registry_course_segments.create({
        data: {
          raceRegistryId,
          order: row.order,
          name: row.name,
          mileMarker: row.mileMarker,
          description: row.description,
          runTip: row.runTip,
          guideLandmarks: row.guideLandmarks,
          guideWater: row.guideWater,
          guideElevation: row.guideElevation,
          sourceSegmentId: row.sourceSegmentId,
        },
      });
    }
  });

  return rows.length;
}

export function countWritableSegmentsInPayload(
  racePayload: Record<string, unknown>
): number {
  const segments = courseSegmentsArrayFromPayload(racePayload);
  if (segments === null) return 0;
  return parseRegistryCourseSegmentsFromWire(segments).length;
}
