export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runs/public/[runId]
 *
 * PUBLIC endpoint to get a single CityRun (no authentication required).
 * [runId] can be the run's id (e.g. cml3904lyslwdknn0yr) or its slug (e.g. wednesday-morning-run).
 * Returns public-safe data only (excludes sensitive fields like staffGeneratedId).
 *
 * Returns:
 * { success: true, run: {...} }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const segment = (runId || '').trim();
    if (!segment) {
      return NextResponse.json({ error: 'Run identifier required' }, { status: 400 });
    }

    const include = {
      runClub: {
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          city: true,
        },
      },
    };

    // Resolve by id first, then by slug (so slug-based URLs work for sharing)
    let run = await prisma.city_runs.findUnique({
      where: { id: segment },
      include,
    });
    if (!run) {
      run = await prisma.city_runs.findUnique({
        where: { slug: segment },
        include,
      });
    }
    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    // Return public-safe fields only (include slug for canonical share URLs)
    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        slug: run.slug ?? null,
        title: run.title,
        citySlug: run.citySlug,
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
    console.error('Error fetching public CityRun:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch CityRun', details: error?.message },
      { status: 500 }
    );
  }
}

