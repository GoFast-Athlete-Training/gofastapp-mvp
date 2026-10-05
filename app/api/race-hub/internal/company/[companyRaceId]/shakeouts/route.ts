export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActiveRaceByCompanyRaceId } from "@/lib/race-hub-internal-company";
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
        city_run_rsvps: {
          include: {
            Athlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                gofastHandle: true,
              },
            },
          },
        },
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

    const runClubId =
      typeof body.runClubId === "string" && body.runClubId.trim()
        ? body.runClubId.trim()
        : null;
    const runBrandId =
      typeof body.runBrandId === "string" && body.runBrandId.trim()
        ? body.runBrandId.trim()
        : null;
    const partnerExtrasRaw = body.partnerExtras;
    const partnerExtras =
      partnerExtrasRaw !== null &&
      partnerExtrasRaw !== undefined &&
      typeof partnerExtrasRaw === "object" &&
      !Array.isArray(partnerExtrasRaw)
        ? partnerExtrasRaw
        : null;

    let title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 200)
        : "";
    let meetUpPoint =
      typeof body.meetUpPoint === "string" && body.meetUpPoint.trim()
        ? body.meetUpPoint.trim().slice(0, 500)
        : "";
    const dateRaw = body.date;
    let runAt =
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

    const bodyHour =
      body.startTimeHour != null && Number.isFinite(Number(body.startTimeHour))
        ? Number(body.startTimeHour)
        : null;
    const bodyMinute =
      body.startTimeMinute != null && Number.isFinite(Number(body.startTimeMinute))
        ? Number(body.startTimeMinute)
        : null;
    const bodyPeriod =
      typeof body.startTimePeriod === "string" && body.startTimePeriod.trim()
        ? body.startTimePeriod.trim()
        : null;
    const fromUtc = utcTo12h(runAt);
    const hour = bodyHour ?? fromUtc.hour;
    const minute = bodyMinute ?? fromUtc.minute;
    const period = bodyPeriod ?? fromUtc.period;

    const id = generateCityRunId();

    const run = await prisma.city_runs.create({
      data: {
        id,
        title,
        date: runAt,
        meetUpPoint,
        meetUpStreetAddress:
          body.meetUpStreetAddress != null && String(body.meetUpStreetAddress).trim()
            ? String(body.meetUpStreetAddress).trim()
            : null,
        meetUpCity:
          body.meetUpCity != null && String(body.meetUpCity).trim()
            ? String(body.meetUpCity).trim()
            : null,
        meetUpState:
          body.meetUpState != null && String(body.meetUpState).trim()
            ? String(body.meetUpState).trim()
            : null,
        meetUpZip:
          body.meetUpZip != null && String(body.meetUpZip).trim()
            ? String(body.meetUpZip).trim()
            : null,
        meetUpPlaceId:
          body.meetUpPlaceId != null && String(body.meetUpPlaceId).trim()
            ? String(body.meetUpPlaceId).trim()
            : null,
        meetUpLat:
          body.meetUpLat != null && Number.isFinite(body.meetUpLat) ? body.meetUpLat : null,
        meetUpLng:
          body.meetUpLng != null && Number.isFinite(body.meetUpLng) ? body.meetUpLng : null,
        endPoint:
          body.endPoint != null && String(body.endPoint).trim()
            ? String(body.endPoint).trim()
            : null,
        endStreetAddress:
          body.endStreetAddress != null && String(body.endStreetAddress).trim()
            ? String(body.endStreetAddress).trim()
            : null,
        endCity:
          body.endCity != null && String(body.endCity).trim() ? String(body.endCity).trim() : null,
        endState:
          body.endState != null && String(body.endState).trim()
            ? String(body.endState).trim()
            : null,
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
        dayOfWeek:
          body.dayOfWeek != null && String(body.dayOfWeek).trim()
            ? String(body.dayOfWeek).trim()
            : null,
        runType:
          body.runType != null && String(body.runType).trim() ? String(body.runType).trim() : null,
        workoutDescription:
          body.workoutDescription != null && String(body.workoutDescription).trim()
            ? String(body.workoutDescription).trim()
            : null,
        directionsText:
          body.directionsText != null && String(body.directionsText).trim()
            ? String(body.directionsText).trim()
            : null,
        stravaMapUrl:
          body.stravaMapUrl != null && String(body.stravaMapUrl).trim()
            ? String(body.stravaMapUrl).trim()
            : null,
        mapImageUrl:
          body.mapImageUrl != null && String(body.mapImageUrl).trim()
            ? String(body.mapImageUrl).trim()
            : null,
        routePhotos: Array.isArray(body.routePhotos) ? body.routePhotos : undefined,
        stravaEventUrl:
          body.stravaEventUrl != null && String(body.stravaEventUrl).trim()
            ? String(body.stravaEventUrl).trim()
            : null,
        stravaText:
          body.stravaText != null && String(body.stravaText).trim()
            ? String(body.stravaText).trim()
            : null,
        webUrl:
          body.webUrl != null && String(body.webUrl).trim() ? String(body.webUrl).trim() : null,
        webText:
          body.webText != null && String(body.webText).trim() ? String(body.webText).trim() : null,
        igPostText:
          body.igPostText != null && String(body.igPostText).trim()
            ? String(body.igPostText).trim()
            : null,
        staffNotes:
          body.staffNotes != null && String(body.staffNotes).trim()
            ? String(body.staffNotes).trim()
            : null,
        routeNeighborhood:
          body.routeNeighborhood != null && String(body.routeNeighborhood).trim()
            ? String(body.routeNeighborhood).trim()
            : null,
        startTimeHour: hour,
        startTimeMinute: minute,
        startTimePeriod: period,
        citySlug,
        regionSlug: inferRegionSlugFromCitySlug(citySlug),
        raceRegistryId: race.id,
        staffGeneratedId,
        workflowStatus: "DEVELOP",
        published: body.published === true,
        runClubId,
        runBrandId,
        partnerExtras,
        cityRunType: "RACE_SHAKEOUT",
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
