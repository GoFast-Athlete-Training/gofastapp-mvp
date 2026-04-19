import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_COMPANY_APP_URL || 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/admin/nuclear-reset-run-clubs
 * DESTRUCTIVE: deletes all prod run_clubs, run_series, and club/series-linked city_runs.
 * Requires a valid Firebase ID token whose custom claims include `staffId` (Company staff — set when linking Firebase in Company app).
 * Body must include { "confirm": "RESET_RUN_CLUB_UNIVERSE" }.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let decoded: import('firebase-admin/auth').DecodedIdToken;
    try {
      decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders });
    }

    const rawStaffId = (decoded as Record<string, unknown>).staffId;
    const staffId =
      typeof rawStaffId === 'string' && rawStaffId.trim() !== '' ? rawStaffId.trim() : null;
    if (!staffId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Company staff only. Sign in with a staff account (Firebase token must include staffId). Try signing out and back in.',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== 'RESET_RUN_CLUB_UNIVERSE') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid confirmation. Send JSON { "confirm": "RESET_RUN_CLUB_UNIVERSE" }',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const deleted = await prisma.$transaction(async (tx) => {
      const runs = await tx.city_runs.deleteMany({
        where: {
          OR: [{ runClubId: { not: null } }, { runSeriesId: { not: null } }],
        },
      });
      const series = await tx.run_series.deleteMany({});
      const clubs = await tx.run_clubs.deleteMany({});
      return { cityRuns: runs.count, runSeries: series.count, runClubs: clubs.count };
    });

    const res = NextResponse.json({
      success: true,
      message: 'Nuclear reset complete. Re-prodpush all clubs from Company.',
      deleted,
    });
    Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[nuclear-reset-run-clubs]', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Nuclear reset failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}
