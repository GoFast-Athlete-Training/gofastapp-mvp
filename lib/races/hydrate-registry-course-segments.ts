import { replaceRegistryCourseSegments } from "@/lib/races/replace-registry-course-segments";
import { prisma } from "@/lib/prisma";

type PublicCourseSegment = {
  id?: string | null;
  order: number;
  name: string;
  mileMarker?: string | null;
  description?: string | null;
  guideExperience?: string | null;
  guideLandmarks?: string | null;
  guideWater?: string | null;
  guideElevation?: string | null;
  runTip?: string | null;
};

export type HydrateRegistryCourseResult = {
  count: number;
  skippedReason?: "GOFAST_RACE_MANAGE_URL";
};

function raceManageBaseUrl(): string | null {
  return (
    process.env.GOFAST_RACE_MANAGE_URL?.trim() ||
    process.env.NEXT_PUBLIC_GOFAST_RACE_MANAGE_URL?.trim() ||
    null
  );
}

/**
 * When prod mirror is empty, copy published course guide segments from Race Manage
 * (same source as the public course page). Uses full replace for the registry row.
 */
export async function hydrateRegistryCourseSegmentsFromRaceManage(params: {
  raceRegistryId: string;
  courseSlug: string | null | undefined;
  raceSlug: string | null | undefined;
}): Promise<HydrateRegistryCourseResult> {
  const slug =
    params.courseSlug?.trim() ||
    params.raceSlug?.trim() ||
    null;
  if (!slug) return { count: 0 };

  const base = raceManageBaseUrl();
  if (!base) {
    console.error(
      "[hydrateRegistryCourseSegments] GOFAST_RACE_MANAGE_URL not set — skip read-through"
    );
    return { count: 0, skippedReason: "GOFAST_RACE_MANAGE_URL" };
  }

  const url = `${base.replace(/\/$/, "")}/api/course-public/by-slug/${encodeURIComponent(slug)}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    console.warn("[hydrateRegistryCourseSegments] fetch failed", e);
    return { count: 0 };
  }
  if (!res.ok) return { count: 0 };

  const data = (await res.json()) as {
    success?: boolean;
    course?: { segments?: PublicCourseSegment[] };
  };
  const segments = data.course?.segments ?? [];
  if (!data.success || segments.length === 0) return { count: 0 };

  const wire = segments
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((seg) => {
      const name = seg.name?.trim();
      if (!name) return null;
      const description =
        seg.description?.trim() || seg.guideExperience?.trim() || null;
      return {
        sourceSegmentId:
          typeof seg.id === "string" && seg.id.trim() ? seg.id.trim() : null,
        order: seg.order,
        name,
        mileMarker:
          typeof seg.mileMarker === "string" ? seg.mileMarker.trim() || null : null,
        description,
        runTip:
          typeof seg.runTip === "string" ? seg.runTip.trim() || null : null,
        guideLandmarks:
          typeof seg.guideLandmarks === "string"
            ? seg.guideLandmarks.trim() || null
            : null,
        guideWater:
          typeof seg.guideWater === "string" ? seg.guideWater.trim() || null : null,
        guideElevation:
          typeof seg.guideElevation === "string"
            ? seg.guideElevation.trim() || null
            : null,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s != null);

  const count = await replaceRegistryCourseSegments(params.raceRegistryId, {
    courseSegments: wire,
  });

  if (count <= 0) {
    return { count: 0 };
  }

  return { count };
}

/** Count segments on a registry row (read-only). */
export async function countRegistryCourseSegments(
  raceRegistryId: string
): Promise<number> {
  return prisma.race_registry_course_segments.count({
    where: { raceRegistryId },
  });
}
