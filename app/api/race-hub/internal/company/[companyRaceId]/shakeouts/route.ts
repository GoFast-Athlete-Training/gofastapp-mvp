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
  applyCityRunCalendarAnchorOnly,
  calendarDateKeyFromDateInput,
  isValidIanaTimezone,
  resolveEventTimezoneForWrite,
} from "@/lib/city-run/city-run-zoned-format";
import { stampCityRunStartsAtOnCreateData } from "@/lib/city-run/stamp-city-run-write";
import { normalizeRunType } from "@/lib/runTypes";
import { parseWallClockFromBody } from "@/lib/city-run/parse-wall-clock-body";
import {
  citySlugFromRegistry,
  generateCityRunId,
  serializeHubShakeout,
} from "@/lib/race-hub-shakeout-utils";
import {
  normalizeRegistrationUrl,
  registrationRequiredFromBody,
} from "@/lib/shakeout-registration";

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
        runStore: { select: { id: true, name: true, slug: true } },
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
    const calendarDateKeyRaw =
      typeof body.calendarDateKey === "string" && body.calendarDateKey.trim()
        ? body.calendarDateKey.trim()
        : typeof body.date === "string" && body.date.trim()
          ? calendarDateKeyFromDateInput(body.date)
          : body.date instanceof Date
            ? calendarDateKeyFromDateInput(body.date.toISOString())
            : null;

    const timezoneInput =
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim()
        : null;
    const timezoneResolved = timezoneInput
      ? resolveEventTimezoneForWrite(timezoneInput)
      : null;

    if (!title || !meetUpPoint || !calendarDateKeyRaw) {
      return NextResponse.json(
        { error: "title, meetUpPoint, and valid date (YYYY-MM-DD) required" },
        { status: 400 }
      );
    }

    const citySlugRaw =
      typeof body.citySlug === "string" && body.citySlug.trim()
        ? body.citySlug.trim().toLowerCase()
        : citySlugFromRegistry(race.city, race.slug);
    const citySlug = citySlugRaw.slice(0, 64);

    const startClock = parseWallClockFromBody(body as Record<string, unknown>, "startTime");
    const checkInClock = parseWallClockFromBody(body as Record<string, unknown>, "checkInTime");
    const hasStartClock = startClock.hasClock;
    const hour = startClock.hour;
    const minute = startClock.minute;
    const period = startClock.period;

    if (hasStartClock && (!timezoneResolved || !isValidIanaTimezone(timezoneResolved))) {
      return NextResponse.json(
        {
          error:
            "Timezone is required when start time is set (e.g. EST or Eastern)",
        },
        { status: 400 }
      );
    }
    if (timezoneInput && (!timezoneResolved || !isValidIanaTimezone(timezoneResolved))) {
      return NextResponse.json(
        { error: "Timezone not recognized (try EST, Eastern, Central, or Pacific)" },
        { status: 400 }
      );
    }

    const runTypeRaw =
      body.runType != null && String(body.runType).trim() ? String(body.runType).trim() : "";
    let runType: string | null = null;
    if (runTypeRaw) {
      const normalized = normalizeRunType(runTypeRaw);
      if (!normalized) {
        return NextResponse.json(
          {
            error:
              "runType must be track, trail, neighborhood, or park (aliases: urban, road, etc.)",
          },
          { status: 400 },
        );
      }
      runType = normalized;
    } else {
      runType = normalizeRunType("urban");
    }

    const shakeoutClubName =
      body.shakeoutClubName != null && String(body.shakeoutClubName).trim()
        ? String(body.shakeoutClubName).trim()
        : null;
    const shakeoutSponsorName =
      body.shakeoutSponsorName != null && String(body.shakeoutSponsorName).trim()
        ? String(body.shakeoutSponsorName).trim()
        : null;

    const id = generateCityRunId();

    const createData: Record<string, unknown> = {
        id,
        title,
        runDay: calendarDateKeyRaw,
        calendarDateKey: calendarDateKeyRaw,
        timezone: timezoneResolved,
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
        runType,
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
        registrationRequired: registrationRequiredFromBody(body.registrationRequired) ?? null,
        registrationUrl: normalizeRegistrationUrl(body.registrationUrl),
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
        instagramPostUrl:
          body.instagramPostUrl != null && String(body.instagramPostUrl).trim()
            ? String(body.instagramPostUrl).trim()
            : null,
        shakeoutClubName,
        shakeoutSponsorName,
        routeNeighborhood:
          body.routeNeighborhood != null && String(body.routeNeighborhood).trim()
            ? String(body.routeNeighborhood).trim()
            : null,
        startTimeHour: hour,
        startTimeMinute: minute,
        startTimePeriod: period,
        checkInTimeHour: checkInClock.hasClock ? checkInClock.hour : null,
        checkInTimeMinute: checkInClock.hasClock ? checkInClock.minute : null,
        checkInTimePeriod: checkInClock.hasClock ? checkInClock.period : null,
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
    };

    if (hasStartClock) {
      stampCityRunStartsAtOnCreateData(createData);
    } else if (timezoneResolved) {
      applyCityRunCalendarAnchorOnly(createData);
    } else {
      applyCityRunCalendarAnchorOnly({
        ...createData,
        timezone: "America/New_York",
      });
    }
    delete createData.calendarDateKey;

    const run = await prisma.city_runs.create({
      data: createData as Parameters<typeof prisma.city_runs.create>[0]["data"],
      include: {
        city_run_rsvps: true,
        runClub: { select: { id: true, name: true, slug: true } },
        runStore: { select: { id: true, name: true, slug: true } },
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
