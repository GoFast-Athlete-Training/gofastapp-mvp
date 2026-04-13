import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.NEXT_PUBLIC_COMPANY_APP_URL ||
    "https://gofasthq.gofastcrushgoals.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

type IncomingRace = Record<string, unknown>;

function slugifyTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Tags from optional `tags` array and/or comma/semicolon `keywords` string. */
function tagsFromPayload(racePayload: IncomingRace): string[] {
  const out: string[] = [];
  const tagsRaw = racePayload.tags;
  if (Array.isArray(tagsRaw)) {
    for (const t of tagsRaw) {
      const s = slugifyTag(String(t));
      if (s) out.push(s);
    }
  }
  const keywordsRaw = racePayload.keywords;
  if (typeof keywordsRaw === "string" && keywordsRaw.trim()) {
    for (const part of keywordsRaw.split(/[,;]/)) {
      const s = slugifyTag(part);
      if (s) out.push(s);
    }
  }
  return [...new Set(out)];
}

/** Upsert segments from Company prodpush; omit key to leave existing rows unchanged. */
async function syncRegistryCourseSegments(
  raceRegistryId: string,
  racePayload: IncomingRace
): Promise<void> {
  if (!("courseSegments" in racePayload)) return;
  const segments = racePayload.courseSegments;
  if (!Array.isArray(segments)) return;

  const incomingIds: string[] = [];
  for (const item of segments) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const companySegmentId =
      typeof o.companySegmentId === "string" && o.companySegmentId.trim()
        ? o.companySegmentId.trim()
        : typeof o.id === "string" && o.id.trim()
          ? o.id.trim()
          : "";
    if (!companySegmentId) continue;
    const orderRaw = o.order;
    const order =
      typeof orderRaw === "number" && Number.isFinite(orderRaw)
        ? orderRaw
        : parseInt(String(orderRaw ?? 0), 10) || 0;
    const name =
      typeof o.name === "string" ? o.name.trim() : String(o.name ?? "").trim();
    if (!name) continue;
    incomingIds.push(companySegmentId);
    const mileMarker =
      typeof o.mileMarker === "string" ? o.mileMarker.trim() || null : null;
    const description =
      typeof o.description === "string" ? o.description.trim() || null : null;
    const runTip =
      typeof o.runTip === "string" ? o.runTip.trim() || null : null;

    await prisma.race_registry_course_segments.upsert({
      where: { companySegmentId },
      create: {
        raceRegistryId,
        companySegmentId,
        order,
        name,
        mileMarker,
        description,
        runTip,
      },
      update: {
        raceRegistryId,
        order,
        name,
        mileMarker,
        description,
        runTip,
      },
    });
  }

  if (incomingIds.length === 0) {
    await prisma.race_registry_course_segments.deleteMany({
      where: { raceRegistryId },
    });
    return;
  }
  await prisma.race_registry_course_segments.deleteMany({
    where: {
      raceRegistryId,
      companySegmentId: { notIn: incomingIds },
    },
  });
}

function logoUrlFromPayload(racePayload: IncomingRace): string | null {
  for (const key of ["raceLogo", "raceDisplayPhoto", "ogImage"] as const) {
    const v = racePayload[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** When key absent, return undefined (do not update). When present, allow null to clear. */
function readOptionalTrimmedString(
  payload: IncomingRace,
  key: string
): string | null | undefined {
  if (!(key in payload)) return undefined;
  const v = payload[key];
  if (v === null) return null;
  if (typeof v === "string") return v.trim() || null;
  return null;
}

function readOptionalDateTime(
  payload: IncomingRace,
  key: string
): Date | null | undefined {
  if (!(key in payload)) return undefined;
  const v = payload[key];
  if (v === null) return null;
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * POST /api/race-registry/update
 * Receives race payload from GoFastCompany (prodpush). Upserts race_registry.
 * Lookup order: slug (per distance) → registryId → companyRaceId+slug → legacy companyRaceId.
 * New rows require `slug`; `companyRaceId` is GoFastCompany races.id (may repeat across distances).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const racePayload = body.race as IncomingRace | undefined;

    if (!racePayload || typeof racePayload !== "object") {
      return NextResponse.json(
        { success: false, error: "race payload is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const companyRaceId =
      racePayload.companyRaceId != null &&
      String(racePayload.companyRaceId).trim()
        ? String(racePayload.companyRaceId).trim()
        : racePayload.id != null && String(racePayload.id).trim()
          ? String(racePayload.id).trim()
          : "";

    if (!companyRaceId) {
      return NextResponse.json(
        {
          success: false,
          error: "companyRaceId or race.id is required",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const registryIdRaw = racePayload.registryId ?? racePayload.prodRaceId;
    const registryId =
      registryIdRaw != null && String(registryIdRaw).trim()
        ? String(registryIdRaw).trim()
        : null;

    const raceDateRaw = racePayload.raceDate;
    if (raceDateRaw == null || raceDateRaw === "") {
      return NextResponse.json(
        {
          success: false,
          error: "raceDate required before pushing to prod",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const raceDate = new Date(String(raceDateRaw));
    if (Number.isNaN(raceDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid raceDate" },
        { status: 400, headers: corsHeaders }
      );
    }

    const nameVal =
      racePayload.name != null ? String(racePayload.name).trim() : "Unnamed race";
    const slugVal =
      racePayload.slug != null && String(racePayload.slug).trim()
        ? String(racePayload.slug).trim()
        : null;

    const isVirtual = Boolean(racePayload.isVirtual);

    const locationCity =
      racePayload.locationCity != null
        ? String(racePayload.locationCity).trim() || null
        : null;
    const state =
      racePayload.state != null
        ? String(racePayload.state).trim() || null
        : null;
    const description =
      racePayload.description != null
        ? String(racePayload.description).trim() || null
        : null;
    const registrationUrl =
      racePayload.registrationUrl != null
        ? String(racePayload.registrationUrl).trim() || null
        : null;

    /** Slim sync: course, charity, venue, keywords, external URLs stay on company only. */
    const tagList = tagsFromPayload(racePayload);
    const logoUrl = logoUrlFromPayload(racePayload);
    const startTimeStr = readOptionalTrimmedString(racePayload, "startTime");

    let distanceLabel: string | null | undefined = undefined;
    if ("distanceLabel" in racePayload) {
      const raw = racePayload.distanceLabel;
      if (raw === null) distanceLabel = null;
      else if (typeof raw === "string") distanceLabel = raw.trim() || null;
      else distanceLabel = null;
    } else if ("distanceLabelSnap" in racePayload) {
      const raw = racePayload.distanceLabelSnap;
      if (raw === null) distanceLabel = null;
      else if (typeof raw === "string") distanceLabel = raw.trim() || null;
      else distanceLabel = null;
    }

    let distanceMeters: number | null | undefined = undefined;
    if ("distanceMeters" in racePayload) {
      const raw = racePayload.distanceMeters;
      if (raw === null) distanceMeters = null;
      else if (typeof raw === "number" && Number.isFinite(raw))
        distanceMeters = Math.round(raw);
      else if (typeof raw === "string" && raw.trim()) {
        const n = parseInt(raw.trim(), 10);
        distanceMeters = Number.isFinite(n) ? n : null;
      } else distanceMeters = null;
    }

    const packetPickupLocation = readOptionalTrimmedString(
      racePayload,
      "packetPickupLocation"
    );
    const packetPickupTime = readOptionalTrimmedString(
      racePayload,
      "packetPickupTime"
    );
    const packetPickupDescription = readOptionalTrimmedString(
      racePayload,
      "packetPickupDescription"
    );
    const spectatorInfo = readOptionalTrimmedString(racePayload, "spectatorInfo");
    const logisticsInfo = readOptionalTrimmedString(racePayload, "logisticsInfo");
    const gearDropInstructions = readOptionalTrimmedString(
      racePayload,
      "gearDropInstructions"
    );
    const courseMapUrlFromPayload = readOptionalTrimmedString(
      racePayload,
      "courseMapUrl"
    );
    const courseSlugFromPayload = readOptionalTrimmedString(
      racePayload,
      "courseSlug"
    );
    const resultsUrlFromPayload = readOptionalTrimmedString(
      racePayload,
      "resultsUrl"
    );
    const packetPickupDate = readOptionalDateTime(
      racePayload,
      "packetPickupDate"
    );

    const summaryPhrase = readOptionalTrimmedString(racePayload, "summaryPhrase");
    let charityNameResolved: string | null | undefined = undefined;
    if ("charityName" in racePayload) {
      charityNameResolved =
        readOptionalTrimmedString(racePayload, "charityName") ?? null;
    } else if ("charitySupports" in racePayload) {
      charityNameResolved =
        readOptionalTrimmedString(racePayload, "charitySupports") ?? null;
    }
    const charityUrlExtra = readOptionalTrimmedString(racePayload, "charityUrl");
    const officialWebsiteUrl = readOptionalTrimmedString(racePayload, "raceUrl");
    const registrationCloseDate = readOptionalDateTime(
      racePayload,
      "registrationDeadline"
    );

    let registrationFee: number | null | undefined = undefined;
    if ("priceCents" in racePayload) {
      const raw = racePayload.priceCents;
      if (raw === null) registrationFee = null;
      else if (typeof raw === "number" && Number.isFinite(raw)) {
        registrationFee = Math.round(raw) / 100;
      } else if (typeof raw === "string" && raw.trim()) {
        const n = parseInt(raw.trim(), 10);
        registrationFee = Number.isFinite(n) ? n / 100 : null;
      } else registrationFee = null;
    }

    const updateData = {
      name: nameVal,
      slug: slugVal,
      raceDate,
      isVirtual,
      city: locationCity,
      state,
      description,
      registrationUrl,
      companyRaceId,
      ...(tagList.length > 0 ? { tags: tagList } : {}),
      logoUrl,
      ...(startTimeStr !== undefined ? { startTime: startTimeStr } : {}),
      ...(distanceLabel !== undefined ? { distanceLabel } : {}),
      ...(distanceMeters !== undefined ? { distanceMeters } : {}),
      ...(packetPickupLocation !== undefined
        ? { packetPickupLocation }
        : {}),
      ...(packetPickupDate !== undefined ? { packetPickupDate } : {}),
      ...(packetPickupTime !== undefined ? { packetPickupTime } : {}),
      ...(packetPickupDescription !== undefined
        ? { packetPickupDescription }
        : {}),
      ...(spectatorInfo !== undefined ? { spectatorInfo } : {}),
      ...(logisticsInfo !== undefined ? { logisticsInfo } : {}),
      ...(gearDropInstructions !== undefined
        ? { gearDropInstructions }
        : {}),
      ...(courseMapUrlFromPayload !== undefined
        ? { courseMapUrl: courseMapUrlFromPayload }
        : {}),
      ...(courseSlugFromPayload !== undefined
        ? { courseSlug: courseSlugFromPayload }
        : {}),
      ...(resultsUrlFromPayload !== undefined
        ? { resultsUrl: resultsUrlFromPayload }
        : {}),
      ...(summaryPhrase !== undefined ? { summaryPhrase } : {}),
      ...(charityNameResolved !== undefined
        ? { charityName: charityNameResolved }
        : {}),
      ...(charityUrlExtra !== undefined ? { charityUrl: charityUrlExtra } : {}),
      ...(officialWebsiteUrl !== undefined
        ? { officialWebsiteUrl }
        : {}),
      ...(registrationCloseDate !== undefined
        ? { registrationCloseDate }
        : {}),
      ...(registrationFee !== undefined ? { registrationFee } : {}),
      updatedAt: new Date(),
    };

    const slugFinal = slugVal || companyRaceId;

    const selectRace = {
      id: true,
      name: true,
      slug: true,
      raceDate: true,
      companyRaceId: true,
    } as const;

    let target:
      | Awaited<ReturnType<typeof prisma.race_registry.findUnique>>
      | null = null;

    /** Prefer slug (per-distance), then explicit registry id, then companyRaceId + slug, then legacy companyRaceId. */
    if (slugVal) {
      target = await prisma.race_registry.findUnique({
        where: { slug: slugVal },
      });
    }
    if (!target && registryId) {
      target = await prisma.race_registry.findUnique({
        where: { id: registryId },
      });
    }
    if (!target && companyRaceId && slugVal) {
      target = await prisma.race_registry.findFirst({
        where: { companyRaceId, slug: slugVal },
      });
    }
    if (!target && companyRaceId) {
      target = await prisma.race_registry.findFirst({
        where: { companyRaceId },
      });
    }
    if (!target) {
      target = await prisma.race_registry.findUnique({
        where: { id: companyRaceId },
      });
    }

    let row;

    if (target) {
      row = await prisma.race_registry.update({
        where: { id: target.id },
        data: {
          ...updateData,
          slug: slugVal ?? target.slug ?? slugFinal,
        },
        select: selectRace,
      });
    } else {
      if (!slugVal) {
        return NextResponse.json(
          {
            success: false,
            error: "slug is required to create a new race_registry row",
          },
          { status: 400, headers: corsHeaders }
        );
      }
      const newId = registryId ?? randomUUID();
      const collision = await prisma.race_registry.findUnique({
        where: { id: newId },
      });
      if (collision) {
        row = await prisma.race_registry.update({
          where: { id: newId },
          data: {
            ...updateData,
            slug: slugVal ?? collision.slug ?? slugFinal,
          },
          select: selectRace,
        });
      } else {
        row = await prisma.race_registry.create({
          data: {
            id: newId,
            country: "USA",
            isActive: true,
            isCancelled: false,
            ...updateData,
            slug: slugVal,
          },
          select: selectRace,
        });
      }
    }

    await syncRegistryCourseSegments(row.id, racePayload);

    const response = NextResponse.json({ success: true, race: row });
    Object.entries(corsHeaders).forEach(([k, v]) =>
      response.headers.set(k, v)
    );
    return response;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[race-registry/update]", error);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Failed to update race registry",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
