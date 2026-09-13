export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runs/public/[runId]
 *
 * Public endpoint to get a single CityRun (no authentication required).
 * [runId] can be run id or slug.
 * Returns public-safe city_run copy + meta only (no workout/plannedWorkout joins).
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
      runSeries: {
        select: {
          id: true,
          slug: true,
          name: true,
          dayOfWeek: true,
          description: true,
          seriesRunRawText: true,
          routeNeighborhood: true,
          runType: true,
          workoutDescription: true,
          postRunActivity: true,
        },
      },
      route: {
        select: {
          id: true,
          name: true,
          stravaUrl: true,
          distanceMiles: true,
          stravaMapUrl: true,
          mapImageUrl: true,
          routePhotos: true,
          routeNeighborhood: true,
          runType: true,
          citySlug: true,
        },
      },
    };

    let run = await prisma.city_runs.findUnique({ where: { id: segment }, include });
    if (!run) run = await prisma.city_runs.findUnique({ where: { slug: segment }, include });
    if (!run) return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });

    const runDescription = run.description ?? run.runSeries?.description ?? null;
    const routeDirections = run.directionsText ?? run.runSeries?.seriesRunRawText ?? null;
    const routeDescription =
      run.workoutDescription ?? run.runSeries?.workoutDescription ?? null;

    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        slug: run.slug ?? null,
        title: run.title,
        citySlug: run.citySlug,
        dayOfWeek: run.dayOfWeek,
        date: run.date.toISOString(),
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
        runDescription,
        routeDirections,
        routeDescription,
        meetUpNote: run.meetUpNote ?? null,
        postRunActivity: run.postRunActivity ?? null,
        stravaMapUrl: run.stravaMapUrl,
        routePhotos: run.routePhotos as string[] | null ?? null,
        mapImageUrl: run.mapImageUrl ?? null,
        routeNeighborhood: run.routeNeighborhood ?? null,
        runType: run.runType ?? null,
        routeId: run.routeId ?? null,
        route: run.route
          ? {
              id: run.route.id,
              name: run.route.name,
              stravaUrl: run.route.stravaUrl,
              distanceMiles: run.route.distanceMiles,
              stravaMapUrl: run.route.stravaMapUrl,
              mapImageUrl: run.route.mapImageUrl,
              routePhotos: run.route.routePhotos as string[] | null,
              routeNeighborhood: run.route.routeNeighborhood,
              runType: run.route.runType,
              citySlug: run.route.citySlug,
            }
          : null,
        runClub: run.runClub || null,
        runSeries: run.runSeries
          ? {
              id: run.runSeries.id,
              slug: run.runSeries.slug,
              name: run.runSeries.name,
              dayOfWeek: run.runSeries.dayOfWeek,
              description: run.runSeries.description ?? null,
              seriesRunRawText: run.runSeries.seriesRunRawText ?? null,
              routeNeighborhood: run.runSeries.routeNeighborhood ?? null,
              runType: run.runSeries.runType ?? null,
              workoutDescription: run.runSeries.workoutDescription ?? null,
              postRunActivity: run.runSeries.postRunActivity ?? null,
            }
          : null,
        instanceType: run.runSeriesId ? 'SERIES' : 'STANDALONE',
        cityRunSetup: run.runSeries
          ? {
              id: run.runSeries.id,
              dayOfWeek: run.runSeries.dayOfWeek,
              name: run.runSeries.name,
            }
          : null,
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
