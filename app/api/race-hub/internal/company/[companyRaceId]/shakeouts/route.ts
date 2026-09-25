export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActiveRaceByCompanyRaceId } from "@/lib/race-hub-internal-company";
import { resolveCityRunType } from "@/lib/city-run-type";
import { inferRegionSlugFromCitySlug } from "@/lib/region-slug";
import {
  assertStaffBearerAuth,
  getForwardedStaffId,
} from "@/lib/training/training-engine-auth";
import {
  citySlugFromRegistry,
  generateCityRunId,
  serializeHubShakeout,
  utcTo12h,
} from "@/lib/race-hub-shakeout-utils";

/** GET — paired city_runs for this registry (editorial + hand-written) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyRaceId: string }> }
) {
  try {
    const unauthorized = await assertStaffBearerAuth(request);
    if (unauthorized) return unauthorized;

    const { companyRaceId } = await params;
    if (!companyRaceId?.trim()) {
      return NextResponse.json({ error: "companyRaceId required" }, { status: 400 });
    }

    const race = await resolveActiveRaceByCompanyRaceId(companyRaceId);
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const runs = await prisma.city_runs.findMany({
      where: { raceRegistryId: race.id },
      orderBy: { date: "asc" },
      include: {
        city_run_rsvps: true,
        runClub: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({
      success: true,
      raceRegistryId: race.id,
      shakeouts: runs.map((r) => serializeHubShakeout(r)),
    });
  } catch (err) {
    console.error("internal company shakeouts GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST — staff creates a city run paired to this race registry */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyRaceId: string }> }
) {
  try {
    const unauthorized = await assertStaffBearerAuth(request);
    if (unauthorized) return unauthorized;

    const staffGeneratedId = getForwardedStaffId(request);
    if (!staffGeneratedId) {
      return NextResponse.json({ error: "Missing staff id" }, { status: 401 });
    }

    const { companyRaceId } = await params;
    if (!companyRaceId?.trim()) {
      return NextResponse.json({ error: "companyRaceId required" }, { status: 400 });
    }

    const race = await resolveActiveRaceByCompanyRaceId(companyRaceId);
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 200)
        : "";
    const meetUpPoint =
      typeof body.meetUpPoint === "string" && body.meetUpPoint.trim()
        ? body.meetUpPoint.trim().slice(0, 500)
        : "";
    const dateRaw = body.date;
    const runAt =
      typeof dateRaw === "string" || dateRaw instanceof Date ? new Date(dateRaw) : null;

    if (!title || !meetUpPoint || !runAt || Number.isNaN(runAt.getTime())) {
      return NextResponse.json(
        { error: "title, meetUpPoint, and valid date required" },
        { status: 400 }
      );
    }

    const citySlugRaw =
      typeof body.citySlug === "string" && body.citySlug.trim()
        ? body.citySlug.trim().toLowerCase()
        : citySlugFromRegistry(race.city, race.slug);
    const citySlug = citySlugRaw.slice(0, 64);

    const { hour, minute, period } = utcTo12h(runAt);
    const id = generateCityRunId();

    const run = await prisma.city_runs.create({
      data: {
        id,
        title,
        date: runAt,
        meetUpPoint,
        meetUpPlaceId:
          body.meetUpPlaceId != null && String(body.meetUpPlaceId).trim()
            ? String(body.meetUpPlaceId).trim()
            : null,
        meetUpLat:
          body.meetUpLat != null && Number.isFinite(body.meetUpLat) ? body.meetUpLat : null,
        meetUpLng:
          body.meetUpLng != null && Number.isFinite(body.meetUpLng) ? body.meetUpLng : null,
        totalMiles:
          body.totalMiles != null && Number.isFinite(body.totalMiles) ? body.totalMiles : null,
        pace: body.pace != null && String(body.pace).trim() ? String(body.pace).trim() : null,
        description:
          body.description != null && String(body.description).trim()
            ? String(body.description).trim()
            : null,
        postRunActivity:
          body.postRunActivity != null && String(body.postRunActivity).trim()
            ? String(body.postRunActivity).trim()
            : null,
        startTimeHour: hour,
        startTimeMinute: minute,
        startTimePeriod: period,
        citySlug,
        regionSlug: inferRegionSlugFromCitySlug(citySlug),
        raceRegistryId: race.id,
        staffGeneratedId,
        workflowStatus: "DEVELOP",
        published: true,
        cityRunType: resolveCityRunType({
          runClubId: null,
          shakeoutDedupeKey: null,
          raceRegistryId: race.id,
        }),
        updatedAt: new Date(),
      },
      include: {
        city_run_rsvps: true,
        runClub: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({
      success: true,
      shakeout: serializeHubShakeout(run),
      raceRegistryId: race.id,
    });
  } catch (err) {
    console.error("internal company shakeouts POST:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
