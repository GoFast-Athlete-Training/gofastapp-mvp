export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCityRunEvent } from '@/lib/cityrun-event-resolver';

/**
 * GET /api/runs/public/[runId]
 *
 * PUBLIC endpoint to get a single CityRunEvent (no authentication required).
 * [runId] can be legacy run id/slug or canonical event id/slug.
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

    const event = await resolveCityRunEvent(segment);
    if (event) {
      const series = event.city_runs;
      const runClub = series?.runClub ?? null;
      return NextResponse.json({
        success: true,
        run: {
          id: event.id,
          cityRunId: series?.id ?? null,
          slug: event.slug ?? null,
          title: series?.title ?? '',
          citySlug: series?.citySlug ?? '',
          dayOfWeek: series?.dayOfWeek ?? null,
          startDate: event.eventDate.toISOString(),
          date: event.eventDate.toISOString(),
          endDate: null,
          runClubId: series?.runClubId ?? null,
          runClubSlug: runClub?.slug || null, // Backward compatibility
          meetUpPoint: event.meetUpPoint,
          meetUpStreetAddress: event.meetUpStreetAddress,
          meetUpCity: event.meetUpCity,
          meetUpState: event.meetUpState,
          meetUpZip: event.meetUpZip,
          meetUpLat: event.meetUpLat,
          meetUpLng: event.meetUpLng,
          startTimeHour: event.startTimeHour,
          startTimeMinute: event.startTimeMinute,
          startTimePeriod: event.startTimePeriod,
          timezone: event.timezone,
          totalMiles: event.totalMiles,
          pace: event.pace,
          description: event.description,
          stravaMapUrl: event.stravaMapUrl,
          runClub,
        },
      });
    }

    // Legacy fallback if city_run_events is not available.
    const legacyInclude = {
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
    let run = await prisma.city_runs.findUnique({ where: { id: segment }, include: legacyInclude });
    if (!run) run = await prisma.city_runs.findUnique({ where: { slug: segment }, include: legacyInclude });
    if (!run) return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });

    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        cityRunId: run.id,
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
        stravaMapUrl: run.stravaMapUrl,
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

