import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveRunClub } from "@/lib/save-runclub";

export const dynamic = "force-dynamic";

// CORS headers for GoFastCompany
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_COMPANY_APP_URL || 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Handle OPTIONS preflight request
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

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
      runClubSlug, // @deprecated: Use runClub object instead
      runClub, // Full RunClub object from GoFastCompany (id, name, logoUrl, city, slug)
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
      meetUpAddress, // @deprecated: Google Maps formatted address - kept for backward compatibility
      meetUpStreetAddress, // Street address (e.g., "1234 Wilson Blvd")
      meetUpCity, // City name (e.g., "Arlington")
      meetUpState, // State abbreviation (e.g., "VA")
      meetUpZip, // ZIP code (e.g., "22201")
      meetUpPlaceId,
      meetUpLat,
      meetUpLng,
      endPoint, // Optional end point if different from meet up point
      endStreetAddress, // End point street address
      endCity, // End point city
      endState, // End point state
      recurrenceRule, // @deprecated: Use isRecurring + dayOfWeek + startDate + endDate instead
      recurrenceEndsOn, // @deprecated: Use endDate instead
      recurrenceNote,
      totalMiles,
      pace,
      stravaMapUrl,
      description,
    } = body;

    // Validate required fields
    // City can come from citySlug, cityName, meetUpCity, or meetUpAddress (backward compatibility)
    if (!citySlug && !cityName && !meetUpCity && !meetUpAddress) {
      return NextResponse.json(
        { success: false, error: "citySlug, cityName, meetUpCity, or meetUpAddress is required to determine city" },
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
      } else if (meetUpCity) {
        // Use city field directly (preferred)
        cityNameToUse = meetUpCity.trim();
      } else if (meetUpAddress) {
        // Parse city from Google Maps formatted address (backward compatibility)
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

    // If runClub object is provided, ensure RunClub exists in DB (dual save)
    // GoFastCompany sends full RunClub object when admin selects from dropdown
    // Smart: Check if exists first, only save if needed
    let finalRunClubSlug: string | null = null;
    if (runClub) {
      // Use full RunClub object (preferred - has id, name, logoUrl, city)
      finalRunClubSlug = runClub.slug || runClubSlug?.trim() || null;
      
      if (finalRunClubSlug) {
        // Save RunClub data directly from provided object (checks if exists first)
        // Uses acqRunClubId and full object from GoFastCompany
        // If already exists, skips save (smart - avoids unnecessary DB writes)
        await saveRunClub({
          slug: finalRunClubSlug,
          name: runClub.name,
          logoUrl: runClub.logoUrl || runClub.logo || null,
          city: runClub.city || null,
        }).catch((error) => {
          console.warn(`Failed to save RunClub during run creation:`, error);
          // Continue with run creation even if RunClub save fails
        });
      }
    } else if (runClubSlug) {
      // Fallback: if only slug provided (backward compatibility)
      finalRunClubSlug = runClubSlug.trim();
      // Don't fetch here - fetch/sync is separate concern
      // RunClub data will be hydrated on display if missing
    }

    // Create the run
    const run = await prisma.run_crew_runs.create({
      data: {
        citySlug: finalCitySlug,
        runCrewId: runCrewId?.trim() || null,
        runClubSlug: finalRunClubSlug,
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
        meetUpAddress: meetUpAddress?.trim() || null, // Backward compatibility
        meetUpStreetAddress: meetUpStreetAddress?.trim() || null,
        meetUpCity: meetUpCity?.trim() || null,
        meetUpState: meetUpState?.trim() || null,
        meetUpZip: meetUpZip?.trim() || null,
        meetUpPlaceId: meetUpPlaceId?.trim() || null,
        meetUpLat: meetUpLat ? parseFloat(meetUpLat) : null,
        meetUpLng: meetUpLng ? parseFloat(meetUpLng) : null,
        endPoint: endPoint?.trim() || null,
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

    const response = NextResponse.json({
      success: true,
      run,
    }, { status: 200 });
    
    // Add CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  } catch (error: any) {
    console.error("❌ RUNS CREATE: Error:", error);
    console.error("❌ RUNS CREATE: Error details:", error?.message, error?.code, error?.stack);
    
    const errorResponse = NextResponse.json(
      {
        success: false,
        error: "Failed to create run",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
    
    // Add CORS headers even on error
    Object.entries(corsHeaders).forEach(([key, value]) => {
      errorResponse.headers.set(key, value);
    });
    
    return errorResponse;
  }
}

