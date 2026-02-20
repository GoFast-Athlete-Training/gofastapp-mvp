import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveRunClub } from "@/lib/save-runclub";
import { generateUniqueCityRunSlug } from "@/lib/slug-utils";

export const dynamic = "force-dynamic";

// Generate a simple unique ID (cuid-like format)
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

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
 * Create a new CityRun (public or private)
 * Called from GoFastCompany admin interface
 * 
 * CityRun is a universal run system - can be public (runClubId set) or private (runCrewId set)
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
      dayOfWeek,
      startDate,
      endDate,
      date, // backward compat: use startDate if not provided
      startTimeHour,
      startTimeMinute,
      startTimePeriod,
      timezone,
      meetUpPoint,
      meetUpStreetAddress,
      meetUpCity,
      meetUpState,
      meetUpZip,
      routeNeighborhood,
      runType,
      workoutDescription,
      meetUpPlaceId,
      meetUpLat,
      meetUpLng,
      endPoint,
      endStreetAddress,
      endCity,
      endState,
      totalMiles,
      pace,
      stravaMapUrl,
      description,
      postRunActivity,
      routePhotos,
      mapImageUrl,
      staffNotes,
      stravaUrl,
      stravaText,
      webUrl,
      webText,
      igPostText,
      igPostGraphic,
    } = body;

    if (!citySlug && !cityName && !meetUpCity && !meetUpStreetAddress) {
      return NextResponse.json(
        { success: false, error: "citySlug, cityName, meetUpCity, or meetUpStreetAddress is required to determine city" },
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
        cityNameToUse = meetUpCity.trim();
      } else if (meetUpStreetAddress) {
        const addressParts = meetUpStreetAddress.split(",").map((p: string) => p.trim());
        if (addressParts.length >= 2) cityNameToUse = addressParts[1];
        else if (addressParts.length === 1) cityNameToUse = addressParts[0];
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
    let finalRunClubId: string | null = null;
    if (runClub) {
      // Use full RunClub object (preferred - has id, name, logoUrl, city)
      const clubSlug = runClub.slug || runClubSlug?.trim() || null;
      
      if (clubSlug) {
        // Save RunClub data directly from provided object (checks if exists first)
        // Uses acqRunClubId and full object from GoFastCompany
        // If already exists, skips save (smart - avoids unnecessary DB writes)
        const savedRunClub = await saveRunClub({
          slug: clubSlug,
          name: runClub.name,
          logoUrl: runClub.logoUrl || runClub.logo || null,
          city: runClub.city || null,
        }).catch((error) => {
          console.warn(`Failed to save RunClub during run creation:`, error);
          return null;
        });
        
        // Get the ID from saved run club (Prisma-generated UUID)
        if (savedRunClub) {
          finalRunClubId = savedRunClub.id;
        }
      }
    } else if (runClubSlug) {
      // Fallback: if only slug provided (backward compatibility)
      // Look up run club by slug to get ID
      const { prisma } = await import('@/lib/prisma');
      const existingRunClub = await prisma.run_clubs.findUnique({
        where: { slug: runClubSlug.trim() },
        select: { id: true },
      });
      if (existingRunClub) {
        finalRunClubId = existingRunClub.id;
      }
      // If not found, will be null - runClub data will be hydrated on display if missing
    }

    // Generate slug from title
    let runSlug: string | null = null;
    try {
      runSlug = await generateUniqueCityRunSlug(title);
    } catch (error) {
      console.warn('Failed to generate slug for CityRun:', error);
      // Continue without slug - can be generated later
    }

    // Create the run
    const run = await prisma.city_runs.create({
      data: {
        id: generateId(),
        citySlug: finalCitySlug,
        slug: runSlug, // URL-friendly slug for better shareability
        runCrewId: runCrewId?.trim() || null,
        runClubId: finalRunClubId, // ✅ Use FK instead of runClubSlug
        staffGeneratedId: staffGeneratedId?.trim() || null,
        athleteGeneratedId: athleteGeneratedId?.trim() || null,
        title: title.trim(),
        workflowStatus: 'DRAFT',
        dayOfWeek: dayOfWeek?.trim() || null,
        startDate: runStartDateObj,
        endDate: runEndDateObj,
        date: runDateObj,
        startTimeHour: startTimeHour ? parseInt(startTimeHour) : null,
        startTimeMinute: startTimeMinute ? parseInt(startTimeMinute) : null,
        startTimePeriod: startTimePeriod?.trim() || null,
        timezone: timezone?.trim() || null,
        meetUpPoint: meetUpPoint.trim(),
        meetUpStreetAddress: meetUpStreetAddress?.trim() || null,
        meetUpCity: meetUpCity?.trim() || null,
        meetUpState: meetUpState?.trim() || null,
        meetUpZip: meetUpZip?.trim() || null,
        routeNeighborhood: routeNeighborhood?.trim() || null,
        runType: runType?.trim() || null,
        workoutDescription: workoutDescription?.trim() || null,
        meetUpPlaceId: meetUpPlaceId?.trim() || null,
        meetUpLat: meetUpLat ? parseFloat(meetUpLat) : null,
        meetUpLng: meetUpLng ? parseFloat(meetUpLng) : null,
        endPoint: endPoint?.trim() || null,
        endStreetAddress: endStreetAddress?.trim() || null,
        endCity: endCity?.trim() || null,
        endState: endState?.trim() || null,
        totalMiles: totalMiles ? parseFloat(totalMiles) : null,
        pace: pace?.trim() || null,
        stravaMapUrl: stravaMapUrl?.trim() || null,
        description: description?.trim() || null,
        postRunActivity: postRunActivity?.trim() || null,
        routePhotos: Array.isArray(routePhotos) && routePhotos.length > 0 ? routePhotos : null,
        mapImageUrl: mapImageUrl?.trim() || null,
        staffNotes: staffNotes?.trim() || null,
        stravaUrl: stravaUrl?.trim() || null,
        stravaText: stravaText?.trim() || null,
        webUrl: webUrl?.trim() || null,
        webText: webText?.trim() || null,
        igPostText: igPostText?.trim() || null,
        igPostGraphic: igPostGraphic?.trim() || null,
        updatedAt: new Date(),
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
        error: "Failed to create CityRun",
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

