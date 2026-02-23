export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/run-series/public/[slug]
 *
 * Public (no auth) endpoint for the /goseries/[slug] page.
 * Returns the run_series + next upcoming city_run + upcoming run list.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const series = await prisma.run_series.findUnique({
      where: { slug },
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

    if (!series) {
      return NextResponse.json(
        { success: false, error: 'Series not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const now = new Date();

    // Next upcoming run in this series
    const nextRun = await prisma.city_runs.findFirst({
      where: {
        runSeriesId: series.id,
        date: { gte: now },
        workflowStatus: { in: ['PENDING', 'SUBMITTED', 'APPROVED'] },
      },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        title: true,
        date: true,
        meetUpPoint: true,
        meetUpStreetAddress: true,
        meetUpCity: true,
        meetUpState: true,
        startTimeHour: true,
        startTimeMinute: true,
        startTimePeriod: true,
        workflowStatus: true,
        _count: { select: { city_run_rsvps: true } },
      },
    });

    // Next 5 upcoming runs (for the full list)
    const upcomingRuns = await prisma.city_runs.findMany({
      where: {
        runSeriesId: series.id,
        date: { gte: now },
        workflowStatus: { in: ['PENDING', 'SUBMITTED', 'APPROVED'] },
      },
      orderBy: { date: 'asc' },
      take: 5,
      select: {
        id: true,
        title: true,
        date: true,
        workflowStatus: true,
        _count: { select: { city_run_rsvps: true } },
      },
    });

    const payload = {
      id: series.id,
      slug: series.slug,
      name: series.name,
      description: series.description,
      dayOfWeek: series.dayOfWeek,
      gofastCity: series.gofastCity,
      meetUpPoint: series.meetUpPoint,
      meetUpStreetAddress: series.meetUpStreetAddress,
      meetUpCity: series.meetUpCity,
      meetUpState: series.meetUpState,
      meetUpPlaceId: series.meetUpPlaceId,
      meetUpLat: series.meetUpLat,
      meetUpLng: series.meetUpLng,
      startTimeHour: series.startTimeHour,
      startTimeMinute: series.startTimeMinute,
      startTimePeriod: series.startTimePeriod,
      startDate: series.startDate?.toISOString() ?? null,
      endDate: series.endDate?.toISOString() ?? null,
      runClub: series.runClub,
      nextRun: nextRun
        ? {
            id: nextRun.id,
            title: nextRun.title,
            date: nextRun.date.toISOString(),
            meetUpPoint: nextRun.meetUpPoint,
            meetUpStreetAddress: nextRun.meetUpStreetAddress,
            meetUpCity: nextRun.meetUpCity,
            meetUpState: nextRun.meetUpState,
            startTimeHour: nextRun.startTimeHour,
            startTimeMinute: nextRun.startTimeMinute,
            startTimePeriod: nextRun.startTimePeriod,
            rsvpCount: nextRun._count.city_run_rsvps,
          }
        : null,
      upcomingRuns: upcomingRuns.map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date.toISOString(),
        rsvpCount: r._count.city_run_rsvps,
      })),
    };

    return NextResponse.json(
      { success: true, series: payload },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[GET /api/run-series/public/[slug]] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch series', details: error?.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
