import { prisma } from "@/lib/prisma";

type PublicCourseSegment = {
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

function raceManageBaseUrl(): string | null {
  return (
    process.env.GOFAST_RACE_MANAGE_URL?.trim() ||
    process.env.NEXT_PUBLIC_GOFAST_RACE_MANAGE_URL?.trim() ||
    null
  );
}

function stableSegmentId(courseSlug: string, order: number, name: string): string {
  const slug = courseSlug.trim().toLowerCase();
  const safeName = name.trim().slice(0, 40).replace(/[^a-z0-9]+/gi, "-");
  return `rm-public:${slug}:${order}:${safeName || "seg"}`;
}

/**
 * When prod mirror is empty, copy published course guide segments from Race Manage
 * (same source as the public course page).
 */
export async function hydrateRegistryCourseSegmentsFromRaceManage(params: {
  raceRegistryId: string;
  courseSlug: string | null | undefined;
  raceSlug: string | null | undefined;
}): Promise<number> {
  const slug =
    params.courseSlug?.trim() ||
    params.raceSlug?.trim() ||
    null;
  if (!slug) return 0;

  const base = raceManageBaseUrl();
  if (!base) {
    console.warn(
      "[hydrateRegistryCourseSegments] GOFAST_RACE_MANAGE_URL not set — skip read-through"
    );
    return 0;
  }

  const url = `${base.replace(/\/$/, "")}/api/course-public/by-slug/${encodeURIComponent(slug)}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    console.warn("[hydrateRegistryCourseSegments] fetch failed", e);
    return 0;
  }
  if (!res.ok) return 0;

  const data = (await res.json()) as {
    success?: boolean;
    course?: { segments?: PublicCourseSegment[] };
  };
  const segments = data.course?.segments ?? [];
  if (!data.success || segments.length === 0) return 0;

  const incomingIds: string[] = [];
  for (const seg of segments.slice().sort((a, b) => a.order - b.order)) {
    const name = seg.name?.trim();
    if (!name) continue;
    const companySegmentId = stableSegmentId(slug, seg.order, name);
    incomingIds.push(companySegmentId);
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
      where: { companySegmentId },
      create: {
        raceRegistryId: params.raceRegistryId,
        companySegmentId,
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
        companySegmentId: { notIn: incomingIds },
      },
    });
  }

  return incomingIds.length;
}
