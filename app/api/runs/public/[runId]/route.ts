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

    // Fetch run (public-safe fields only)
    const run = await prisma.city_runs.findUnique({
      where: { id: runId },
      select: {
        id: true,
        title: true,
        citySlug: true,
        isRecurring: true,
        dayOfWeek: true,
        startDate: true,
        date: true,
        endDate: true,
        runClubSlug: true,
        meetUpPoint: true,
        meetUpStreetAddress: true,
        meetUpCity: true,
        meetUpState: true,
        meetUpZip: true,
        meetUpLat: true,
        meetUpLng: true,
        startTimeHour: true,
        startTimeMinute: true,
        startTimePeriod: true,
        timezone: true,
        totalMiles: true,
        pace: true,
        description: true,
        stravaMapUrl: true,
        // Exclude sensitive fields:
        // runCrewId, athleteGeneratedId, staffGeneratedId
      },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Optionally hydrate RunClub data
    let runClub = null;
    if (run.runClubSlug) {
      runClub = await prisma.run_clubs.findUnique({
        where: { slug: run.runClubSlug },
        select: {
          slug: true,
          name: true,
          logoUrl: true,
          city: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      run: {
        ...run,
        runClub: runClub || null,
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

