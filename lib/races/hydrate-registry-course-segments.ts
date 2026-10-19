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
 * (same source as the public course page).
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

  const incomingIds: string[] = [];
  for (const seg of segments.slice().sort((a, b) => a.order - b.order)) {
    const name = seg.name?.trim();
    if (!name) continue;
    const sourceSegmentId =
      typeof seg.id === "string" && seg.id.trim() ? seg.id.trim() : "";
    if (!sourceSegmentId) continue;
    incomingIds.push(sourceSegmentId);
    const description =
      seg.description?.trim() || seg.guideExperience?.trim() || null;
    const mileMarker =
      typeof seg.mileMarker === "string" ? seg.mileMarker.trim() || null : null;
    const runTip =
      typeof seg.runTip === "string" ? seg.runTip.trim() || null : null;
    const guideLandmarks =
      typeof seg.guideLandmarks === "string" ? seg.guideLandmarks.trim() || null : null;
    const guideWater =
      typeof seg.guideWater === "string" ? seg.guideWater.trim() || null : null;
    const guideElevation =
      typeof seg.guideElevation === "string" ? seg.guideElevation.trim() || null : null;

    await prisma.race_registry_course_segments.upsert({
      where: { sourceSegmentId },
      create: {
        raceRegistryId: params.raceRegistryId,
        sourceSegmentId,
        order: seg.order,
        name,
        mileMarker,
        description,
        runTip,
        guideLandmarks,
        guideWater,
        guideElevation,
      },
      update: {
        raceRegistryId: params.raceRegistryId,
        order: seg.order,
        name,
        mileMarker,
        description,
        runTip,
        guideLandmarks,
        guideWater,
        guideElevation,
      },
    });
  }

  if (incomingIds.length > 0) {
    await prisma.race_registry_course_segments.deleteMany({
      where: {
        raceRegistryId: params.raceRegistryId,
        sourceSegmentId: { notIn: incomingIds },
      },
    });
  }

  return { count: incomingIds.length };
}
