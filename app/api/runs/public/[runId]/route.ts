export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runs/public/[runId]
 * 
 * PUBLIC endpoint to get a single run (no authentication required)
 * Returns public-safe data only
 * 
 * Returns:
 * {
 *   success: true,
 *   run: {...}
 * }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    // Fetch run with RunClub relation (FK)
    const run = await prisma.city_runs.findUnique({
      where: { id: runId },
      include: {
        runClub: {
          select: {
            id: true,
            slug: true,
            name: true,
            logoUrl: true,
            city: true,
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Return public-safe fields only
    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        title: run.title,
        citySlug: run.citySlug,
        isRecurring: run.isRecurring,
        dayOfWeek: run.dayOfWeek,
        startDate: run.startDate.toISOString(),
        date: run.date.toISOString(),
        endDate: run.endDate?.toISOString() || null,
        runClubId: run.runClubId,
        runClubSlug: run.runClub?.slug || null, // For backward compatibility
        meetUpPoint: run.meetUpPoint,
        meetUpStreetAddress: run.meetUpStreetAddress,
        meetUpCity: run.meetUpCity,
        meetUpState: run.meetUpState,
        meetUpZip: run.meetUpZip,
        meetUpLat: run.meetUpLat,
        meetUpLng: run.meetUpLng,
        startTimeHour: run.startTimeHour,
        startTimeMinute: run.startTimeMinute,
        startTimePeriod: run.startTimePeriod,
        timezone: run.timezone,
        totalMiles: run.totalMiles,
        pace: run.pace,
        description: run.description,
        stravaMapUrl: run.stravaMapUrl,
        runClub: run.runClub || null,
        // Exclude sensitive fields:
        // runCrewId, athleteGeneratedId, staffGeneratedId
      },
    });
  } catch (error: any) {
    console.error('Error fetching public run:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch run', details: error?.message },
      { status: 500 }
    );
  }
}

