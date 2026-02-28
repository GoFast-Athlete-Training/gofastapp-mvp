export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * GET /api/run-series/[id]
 * Fetch a single run_series by id (for CityRunSeriesManage / edit).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const series = await prisma.run_series.findUnique({
      where: { id },
      include: {
        runClub: {
          select: {
            id: true,
            slug: true,
            name: true,
            logoUrl: true,
            city: true,
            websiteUrl: true,
            runUrl: true,
            allRunsDescription: true,
            stravaUrl: true,
          },
        },
        _count: { select: { city_runs: true } },
      },
    });

    if (!series) {
      return NextResponse.json({ error: 'Run series not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      series: {
        id: series.id,
        slug: series.slug,
        dayOfWeek: series.dayOfWeek,
        name: series.name,
        description: series.description,
        seriesRunRawText: series.seriesRunRawText,
        runClubId: series.runClubId,
        workflowStatus: series.workflowStatus,
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
        runCount: series._count.city_runs,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/run-series/[id]] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch run series', details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/run-series/[id]
 * Update run_series (edit from CityRunSeriesManage).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.run_series.findUnique({
      where: { id },
      include: {
        runClub: { select: { slug: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Run series not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Backfill slug if missing (e.g. series created before unique-slug logic)
    if (!existing.slug?.trim()) {
      const slugBase = slugifyForSeries(
        (existing.runClub?.slug || existing.runClubId || id) + '-' + (existing.dayOfWeek || '').toLowerCase()
      );
      const slug = await generateUniqueSeriesSlug(prisma, slugBase);
      updateData.slug = slug;
    }

    const allowed = [
      'name', 'description', 'seriesRunRawText', 'gofastCity', 'meetUpPoint', 'meetUpStreetAddress',
      'meetUpCity', 'meetUpState', 'meetUpPlaceId', 'meetUpLat', 'meetUpLng',
      'startTimeHour', 'startTimeMinute', 'startTimePeriod', 'startDate', 'endDate', 'slug',
    ];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'meetUpLat' || key === 'meetUpLng') {
          (updateData as any)[key] = body[key] == null ? null : parseFloat(String(body[key]));
        } else if (key === 'startTimeHour' || key === 'startTimeMinute') {
          (updateData as any)[key] = body[key] == null ? null : parseInt(String(body[key]), 10);
        } else if (key === 'startDate' || key === 'endDate') {
          (updateData as any)[key] = body[key] ? new Date(body[key]) : null;
        } else {
          (updateData as any)[key] = body[key] === '' ? null : body[key];
        }
      }
    }

    const series = await prisma.run_series.update({
      where: { id },
      data: updateData as any,
      include: {
        runClub: {
          select: {
            id: true,
            slug: true,
            name: true,
            logoUrl: true,
            city: true,
            websiteUrl: true,
            runUrl: true,
            allRunsDescription: true,
            stravaUrl: true,
          },
        },
        _count: { select: { city_runs: true } },
      },
    });

    return NextResponse.json({
      success: true,
      series: {
        id: series.id,
        slug: series.slug,
        dayOfWeek: series.dayOfWeek,
        name: series.name,
        description: series.description,
        seriesRunRawText: series.seriesRunRawText,
        runClubId: series.runClubId,
        workflowStatus: series.workflowStatus,
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
        runCount: series._count.city_runs,
      },
    });
  } catch (error: any) {
    console.error('[PUT /api/run-series/[id]] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update run series', details: error?.message },
      { status: 500 }
    );
  }
}

function slugifyForSeries(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'series';
}

/**
 * DELETE /api/run-series/[id]
 * Delete a run_series (cascade deletes associated city_runs).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    
    const existing = await prisma.run_series.findUnique({
      where: { id },
      include: {
        _count: { select: { city_runs: true } },
      },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Run series not found' }, { status: 404 });
    }

    // Delete the series (cascade will delete associated city_runs)
    await prisma.run_series.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted run series and ${existing._count.city_runs} associated run(s)`,
    });
  } catch (error: any) {
    console.error('[DELETE /api/run-series/[id]] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete run series', details: error?.message },
      { status: 500 }
    );
  }
}

async function generateUniqueSeriesSlug(
  prisma: { run_series: { findFirst: (args: { where: { slug: string } }) => Promise<{ id: string } | null> } },
  base: string
): Promise<string> {
  let slug = base;
  let n = 1;
  while (await prisma.run_series.findFirst({ where: { slug } })) {
    slug = `${base}-${n}`;
    n++;
  }
  return slug;
}
