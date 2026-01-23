import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/runs/create
 * Create a new city run (public or private)
 * Called from GoFastCompany admin interface
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cityId,
      runCrewId,
      runClubSlug,
      staffId,
      createdById,
      title,
      runType = "single",
      date,
      startTimeHour,
      startTimeMinute,
      startTimePeriod,
      timezone,
      meetUpPoint,
      meetUpAddress,
      meetUpPlaceId,
      meetUpLat,
      meetUpLng,
      recurrenceRule,
      recurrenceEndsOn,
      recurrenceNote,
      totalMiles,
      pace,
      stravaMapUrl,
      description,
    } = body;

    // Validate required fields
    if (!cityId || !cityId.trim()) {
      return NextResponse.json(
        { success: false, error: "cityId is required" },
        { status: 400 }
      );
    }

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "title is required" },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { success: false, error: "date is required" },
        { status: 400 }
      );
    }

    if (!meetUpPoint || !meetUpPoint.trim()) {
      return NextResponse.json(
        { success: false, error: "meetUpPoint is required" },
        { status: 400 }
      );
    }

    // Either staffId (GoFastCompany) or createdById (user) must be provided
    if (!staffId && !createdById) {
      return NextResponse.json(
        { success: false, error: "Either staffId or createdById is required" },
        { status: 400 }
      );
    }

    // Verify city exists
    const city = await prisma.cities.findUnique({
      where: { id: cityId },
    });

    if (!city) {
      return NextResponse.json(
        { success: false, error: "City not found" },
        { status: 404 }
      );
    }

    // If runCrewId is set, verify crew exists
    if (runCrewId) {
      const crew = await prisma.run_crews.findUnique({
        where: { id: runCrewId },
      });

      if (!crew) {
        return NextResponse.json(
          { success: false, error: "Run crew not found" },
          { status: 404 }
        );
      }
    }

    // Parse date
    const runDate = new Date(date);

    // Create the run
    const run = await prisma.city_runs.create({
      data: {
        cityId: cityId.trim(),
        runCrewId: runCrewId?.trim() || null,
        runClubSlug: runClubSlug?.trim() || null,
        staffId: staffId?.trim() || null,
        createdById: createdById?.trim() || null,
        title: title.trim(),
        runType: runType || "single",
        date: runDate,
        startTimeHour: startTimeHour ? parseInt(startTimeHour) : null,
        startTimeMinute: startTimeMinute ? parseInt(startTimeMinute) : null,
        startTimePeriod: startTimePeriod?.trim() || null,
        timezone: timezone?.trim() || null,
        meetUpPoint: meetUpPoint.trim(),
        meetUpAddress: meetUpAddress?.trim() || null,
        meetUpPlaceId: meetUpPlaceId?.trim() || null,
        meetUpLat: meetUpLat ? parseFloat(meetUpLat) : null,
        meetUpLng: meetUpLng ? parseFloat(meetUpLng) : null,
        recurrenceRule: recurrenceRule?.trim() || null,
        recurrenceEndsOn: recurrenceEndsOn ? new Date(recurrenceEndsOn) : null,
        recurrenceNote: recurrenceNote?.trim() || null,
        totalMiles: totalMiles ? parseFloat(totalMiles) : null,
        pace: pace?.trim() || null,
        stravaMapUrl: stravaMapUrl?.trim() || null,
        description: description?.trim() || null,
      },
      include: {
        cities: true,
        run_crews: true,
      },
    });

    return NextResponse.json({
      success: true,
      run,
    });
  } catch (error: any) {
    console.error("❌ RUNS CREATE: Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create run",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

