export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * GET /api/run-series
 *
 * List all run_series (recurring series) for dashboard / godview.
 * Same auth as GET /api/runs (Bearer token).
 * Used by GoFastCompany run dashboard "Run Series" card.
 */
export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const workflowStatus = url.searchParams.get('workflowStatus');
    const runClubId = url.searchParams.get('runClubId');

    const validStatuses = ['DEVELOP', 'PENDING', 'SUBMITTED', 'APPROVED'] as const;
    type SeriesStatus = typeof validStatuses[number];
    const where: { workflowStatus?: SeriesStatus; runClubId?: string } = {};
    if (validStatuses.includes(workflowStatus as SeriesStatus)) {
      where.workflowStatus = workflowStatus as SeriesStatus;
    }
    if (runClubId) {
      where.runClubId = runClubId;
    }

    const series = await prisma.run_series.findMany({
      where,
      orderBy: [{ runClubId: 'asc' }, { dayOfWeek: 'asc' }],
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
        _count: {
          select: { city_runs: true },
        },
      },
    });

    const payload = series.map((s) => ({
      id: s.id,
      slug: s.slug,
      dayOfWeek: s.dayOfWeek,
      name: s.name,
      runClubId: s.runClubId,
      workflowStatus: s.workflowStatus,
      startDate: s.startDate?.toISOString() ?? null,
      endDate: s.endDate?.toISOString() ?? null,
      runClub: s.runClub,
      runCount: s._count.city_runs,
    }));

    return NextResponse.json({
      success: true,
      runSeries: payload,
    });
  } catch (error: any) {
    console.error('[GET /api/run-series] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch run series', details: error?.message },
      { status: 500 }
    );
  }
}
