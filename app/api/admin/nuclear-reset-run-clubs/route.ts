import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
 *
 * Same trust model as POST /api/run-clubs/update and /api/run-series/create: Product trusts
 * Company-initiated writes. Only GoFastCompany should call this; it verifies company_staff
 * before proxying. Body must include { "confirm": "RESET_RUN_CLUB_UNIVERSE" }.
 */
export async function POST(request: NextRequest) {
  try {
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
