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
      citySlug, // City slug (e.g., "boston", "new-york") - extracted from Google Maps or user input
      cityName, // Optional: City name for slug generation if slug not provided
      state, // Optional: State abbreviation for slug generation
      runCrewId,
      runClubSlug,
      staffGeneratedId,
      athleteGeneratedId,
      title,
      isRecurring = false, // Boolean: true = recurring/standing run, false = single run
      dayOfWeek, // String: Day of week for recurring runs (e.g., "Monday", "Tuesday")
      startDate, // DateTime: Start date (for single runs, this is the run date; for recurring, when recurrence starts)
      endDate, // DateTime?: End date for recurring runs
      date, // @deprecated: Use startDate instead (kept for backward compatibility)
      startTimeHour,
      startTimeMinute,
      startTimePeriod,
      timezone,
      meetUpPoint,
      meetUpAddress, // Google Maps formatted address - used to extract city if needed
      meetUpPlaceId,
      meetUpLat,
      meetUpLng,
      recurrenceRule, // @deprecated: Use isRecurring + dayOfWeek + startDate + endDate instead
      recurrenceEndsOn, // @deprecated: Use endDate instead
      recurrenceNote,
      totalMiles,
      pace,
      stravaMapUrl,
      description,
    } = body;

    // Validate required fields
    if (!citySlug && !cityName && !meetUpAddress) {
      return NextResponse.json(
        { success: false, error: "citySlug, cityName, or meetUpAddress is required to determine city" },
        { status: 400 }
      );
    }

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "title is required" },
        { status: 400 }
      );
    }

    // Use startDate if provided, otherwise fall back to date for backward compatibility
    const runStartDate = startDate || date;
    if (!runStartDate) {
      return NextResponse.json(
        { success: false, error: "startDate or date is required" },
        { status: 400 }
      );
    }

    // Validate recurring run fields
    if (isRecurring && !dayOfWeek) {
      return NextResponse.json(
        { success: false, error: "dayOfWeek is required for recurring runs" },
        { status: 400 }
      );
    }

    if (!meetUpPoint || !meetUpPoint.trim()) {
      return NextResponse.json(
        { success: false, error: "meetUpPoint is required" },
        { status: 400 }
      );
    }

    // Either staffGeneratedId (GoFastCompany) or athleteGeneratedId (user) must be provided
    if (!staffGeneratedId && !athleteGeneratedId) {
      return NextResponse.json(
        { success: false, error: "Either staffGeneratedId or athleteGeneratedId is required" },
        { status: 400 }
      );
    }

    // If athleteGeneratedId is provided, verify athlete exists
    if (athleteGeneratedId) {
      const athlete = await prisma.athlete.findUnique({
        where: { id: athleteGeneratedId },
      });

      if (!athlete) {
        return NextResponse.json(
          { success: false, error: "Athlete not found" },
          { status: 404 }
        );
      }
    }

    // Generate city slug from various inputs
    let finalCitySlug: string;
    
    if (citySlug) {
      // Use provided slug (normalize it)
      finalCitySlug = citySlug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    } else {
      // Extract city name from various sources
      let cityNameToUse: string | null = null;
      
      if (cityName) {
        cityNameToUse = cityName.trim();
      } else if (meetUpAddress) {
        // Parse city from Google Maps formatted address
        // Format: "123 Main St, City, State ZIP, Country"
        // Try to extract city (usually second-to-last component before country)
        const addressParts = meetUpAddress.split(",").map((p: string) => p.trim());
        if (addressParts.length >= 2) {
          // City is typically the second part (index 1)
          cityNameToUse = addressParts[1];
        } else if (addressParts.length === 1) {
          // Fallback: use the address itself
          cityNameToUse = addressParts[0];
        }
      }
      
      if (!cityNameToUse) {
        return NextResponse.json(
          { success: false, error: "Could not determine city from provided data" },
          { status: 400 }
        );
      }
      
      // Generate slug from city name
      finalCitySlug = cityNameToUse
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
    
    if (!finalCitySlug) {
      return NextResponse.json(
        { success: false, error: "Invalid city slug" },
        { status: 400 }
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

    // Parse dates
    const runStartDateObj = new Date(runStartDate);
    const runEndDateObj = endDate ? new Date(endDate) : null;
    const runDateObj = date ? new Date(date) : runStartDateObj; // Backward compatibility

    // Create the run
    const run = await prisma.city_runs.create({
      data: {
        citySlug: finalCitySlug,
        runCrewId: runCrewId?.trim() || null,
        runClubSlug: runClubSlug?.trim() || null,
        staffGeneratedId: staffGeneratedId?.trim() || null,
        athleteGeneratedId: athleteGeneratedId?.trim() || null,
        title: title.trim(),
        isRecurring: isRecurring === true,
        dayOfWeek: dayOfWeek?.trim() || null,
        startDate: runStartDateObj,
        endDate: runEndDateObj,
        date: runDateObj, // Backward compatibility - sync with startDate
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
        run_crews: true,
        Athlete: true,
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

