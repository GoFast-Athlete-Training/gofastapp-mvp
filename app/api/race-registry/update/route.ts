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

/**
 * POST /api/race-registry/update
 * Receives race payload from GoFastCompany (prodpush). Upserts race_registry.
 * Company races.id === race_registry.id; companyRaceId mirrors races.id.
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

    const id =
      racePayload.id != null ? String(racePayload.id).trim() : "";
    if (!id) {
      return NextResponse.json(
        { success: false, error: "race.id is required" },
        { status: 400, headers: corsHeaders }
      );
    }

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

    const companyRaceId = id;

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
      updatedAt: new Date(),
    };

    const slugFinal = slugVal || id;

    let row;

    const existingById = await prisma.race_registry.findUnique({
      where: { id },
    });
    const existingBySlug = slugVal
      ? await prisma.race_registry.findUnique({
          where: { slug: slugVal },
        })
      : null;

    if (existingBySlug && existingBySlug.id !== id) {
      row = await prisma.race_registry.update({
        where: { id: existingBySlug.id },
        data: {
          ...updateData,
          slug: slugVal ?? existingBySlug.slug,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          raceDate: true,
          companyRaceId: true,
        },
      });
    } else if (existingById) {
      row = await prisma.race_registry.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          slug: true,
          raceDate: true,
          companyRaceId: true,
        },
      });
    } else {
      row = await prisma.race_registry.create({
        data: {
          id,
          country: "USA",
          isActive: true,
          isCancelled: false,
          ...updateData,
          slug: slugVal ?? slugFinal,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          raceDate: true,
          companyRaceId: true,
        },
      });
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
