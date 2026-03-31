import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapRaceCategoryToRegistry } from "@/lib/race-category-map";

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

function logoUrlFromPayload(racePayload: IncomingRace): string | null {
  for (const key of ["raceLogo", "raceDisplayPhoto", "ogImage"] as const) {
    const v = racePayload[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Map company `startTime` (ISO or same-day clock time) onto registry `startTime`. */
function parseRegistryStartTime(
  raceDate: Date,
  raw: unknown
): Date | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const asIso = new Date(s);
  if (!Number.isNaN(asIso.getTime()) && (s.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(s))) {
    return asIso;
  }
  const y = raceDate.getUTCFullYear();
  const m = raceDate.getUTCMonth();
  const d = raceDate.getUTCDate();
  const match = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  const sec = match[3] ? parseInt(match[3], 10) : 0;
  const ap = match[4]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (
    Number.isNaN(h) ||
    Number.isNaN(min) ||
    Number.isNaN(sec) ||
    min > 59 ||
    sec > 59
  ) {
    return null;
  }
  return new Date(Date.UTC(y, m, d, h, min, sec, 0));
}

/**
 * POST /api/race-registry/update
 * Receives race payload from GoFastCompany (prodpush). Upserts race_registry.
 * Prefer companyRaceId (GoFastCompany races.id). Optional registryId / prodRaceId
 * is race_registry.id when the row already exists in the athlete app.
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

    const category =
      racePayload.category != null ? String(racePayload.category) : null;
    const { raceType, distanceMiles, isVirtual } =
      mapRaceCategoryToRegistry(category);

    const locationCity =
      racePayload.locationCity != null
        ? String(racePayload.locationCity).trim() || null
        : null;
    const state =
      racePayload.state != null
        ? String(racePayload.state).trim() || null
        : null;
    const street =
      racePayload.streetAddress != null
        ? String(racePayload.streetAddress).trim()
        : "";
    const addr =
      racePayload.address != null ? String(racePayload.address).trim() : "";
    const address = street || addr || null;

    const venueName =
      racePayload.venueName != null
        ? String(racePayload.venueName).trim() || null
        : null;
    const description =
      racePayload.description != null
        ? String(racePayload.description).trim() || null
        : null;
    const registrationUrl =
      racePayload.registrationUrl != null
        ? String(racePayload.registrationUrl).trim() || null
        : null;
    const courseMapUrl =
      racePayload.courseMapUrl != null
        ? String(racePayload.courseMapUrl).trim() || null
        : null;
    const charitySupports =
      racePayload.charitySupports != null
        ? String(racePayload.charitySupports).trim() || null
        : null;
    const raceUrl =
      racePayload.raceUrl != null
        ? String(racePayload.raceUrl).trim() || null
        : null;

    const tags = tagsFromPayload(racePayload);
    const logoUrl = logoUrlFromPayload(racePayload);
    const startTimeParsed = parseRegistryStartTime(
      raceDate,
      racePayload.startTime
    );

    const updateData = {
      name: nameVal,
      slug: slugVal,
      raceDate,
      raceType,
      distanceMiles,
      isVirtual,
      city: locationCity,
      state,
      address,
      startLocation: venueName,
      description,
      registrationUrl,
      courseMapUrl,
      charityName: charitySupports,
      officialWebsiteUrl: raceUrl,
      companyRaceId,
      tags,
      logoUrl,
      ...(startTimeParsed ? { startTime: startTimeParsed } : {}),
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

    if (registryId) {
      target = await prisma.race_registry.findUnique({
        where: { id: registryId },
      });
    }
    if (!target) {
      target = await prisma.race_registry.findFirst({
        where: { companyRaceId },
      });
    }
    if (!target) {
      target = await prisma.race_registry.findUnique({
        where: { id: companyRaceId },
      });
    }
    if (!target && slugVal) {
      const bySlug = await prisma.race_registry.findUnique({
        where: { slug: slugVal },
      });
      if (
        bySlug &&
        (!bySlug.companyRaceId ||
          bySlug.companyRaceId === companyRaceId ||
          (registryId && bySlug.id === registryId))
      ) {
        target = bySlug;
      }
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
      const newId = registryId ?? companyRaceId;
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
            slug: slugVal ?? slugFinal,
          },
          select: selectRace,
        });
      }
    }

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
