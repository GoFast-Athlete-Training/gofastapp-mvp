export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runs/public/[runId]
 *
 * Public endpoint to get a single CityRun (no authentication required).
 * [runId] can be run id or slug.
 * Returns public-safe data only (excludes staffNotes, staffGeneratedId, etc).
 *
 * Model C: reads city_runs directly. No event resolver.
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
          description: true,
          websiteUrl: true,
          instagramUrl: true,
          stravaUrl: true,
        },
      },
    };

    let run = await prisma.city_runs.findUnique({ where: { id: segment }, include });
    if (!run) run = await prisma.city_runs.findUnique({ where: { slug: segment }, include });
    if (!run) return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });

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
        runClubSlug: run.runClub?.slug || null,
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
        postRunActivity: run.postRunActivity ?? null,
        stravaMapUrl: run.stravaMapUrl,
        routePhotos: run.routePhotos as string[] | null ?? null,
        mapImageUrl: run.mapImageUrl ?? null,
        routeNeighborhood: run.routeNeighborhood ?? null,
        runType: run.runType ?? null,
        workoutDescription: run.workoutDescription ?? null,
        runClub: run.runClub || null,
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
