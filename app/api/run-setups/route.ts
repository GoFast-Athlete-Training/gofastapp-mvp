export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * GET /api/run-setups
 *
 * List all city_run_setups (recurring series) for dashboard / godview.
 * Same auth as GET /api/runs (Bearer token).
 * Used by GoFastCompany run dashboard "Run Recurring (all city setup)" card.
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

    const setups = await prisma.city_run_setups.findMany({
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

    const payload = setups.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      name: s.name,
      runClubId: s.runClubId,
      startDate: s.startDate?.toISOString() ?? null,
      endDate: s.endDate?.toISOString() ?? null,
      runClub: s.runClub,
      runCount: s._count.city_runs,
    }));

    return NextResponse.json({
      success: true,
      runSetups: payload,
    });
  } catch (error: any) {
    console.error('[GET /api/run-setups] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch run setups', details: error?.message },
      { status: 500 }
    );
  }
}
