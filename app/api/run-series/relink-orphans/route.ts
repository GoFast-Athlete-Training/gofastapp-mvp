import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';
import { toCanonicalDayOfWeek } from '@/lib/utils/dayOfWeekConverter';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_COMPANY_APP_URL || 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

type Body = {
  runClubId?: string;
  dayOfWeek?: string;
  seriesId?: string;
};

/**
 * POST /api/run-series/relink-orphans
 * Re-link city_runs with runSeriesId=null to the matching run_series (same club + day; optional time match).
 * Body: { runClubId, seriesId? } or { runClubId, dayOfWeek? } — if seriesId set, use that series; else pick by dayOfWeek.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401, headers: corsHeaders });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const runClubId = body.runClubId?.trim();
    if (!runClubId) {
      return NextResponse.json(
        { success: false, error: 'runClubId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    let series: { id: string; dayOfWeek: string; runClubId: string | null; startTimeHour: number | null; startTimeMinute: number | null } | null = null;

    if (body.seriesId?.trim()) {
      series = await prisma.run_series.findUnique({
        where: { id: body.seriesId.trim() },
        select: {
          id: true,
          dayOfWeek: true,
          runClubId: true,
          startTimeHour: true,
          startTimeMinute: true,
        },
      });
      if (!series || series.runClubId !== runClubId) {
        return NextResponse.json(
          { success: false, error: 'series not found or runClubId mismatch' },
          { status: 404, headers: corsHeaders }
        );
      }
    } else {
      const dayRaw = body.dayOfWeek?.trim();
      if (!dayRaw) {
        return NextResponse.json(
          { success: false, error: 'Provide seriesId or dayOfWeek' },
          { status: 400, headers: corsHeaders }
        );
      }
      const canonicalDay = toCanonicalDayOfWeek(dayRaw) ?? dayRaw.toUpperCase();
      const candidates = await prisma.run_series.findMany({
        where: { runClubId, dayOfWeek: canonicalDay },
        select: {
          id: true,
          dayOfWeek: true,
          runClubId: true,
          startTimeHour: true,
          startTimeMinute: true,
        },
      });
      if (candidates.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No run_series for this club and day' },
          { status: 404, headers: corsHeaders }
        );
      }
      if (candidates.length > 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Multiple run_series for this day; pass seriesId to choose one',
            seriesIds: candidates.map((c) => c.id),
          },
          { status: 409, headers: corsHeaders }
        );
      }
      series = candidates[0];
    }

    const canonicalDay = toCanonicalDayOfWeek(series.dayOfWeek) ?? series.dayOfWeek;

    const where: {
      runClubId: string;
      dayOfWeek: string;
      runSeriesId: null;
      startTimeHour?: number;
      startTimeMinute?: number;
    } = {
      runClubId,
      dayOfWeek: canonicalDay,
      runSeriesId: null,
    };

    if (
      series.startTimeHour != null &&
      series.startTimeMinute != null
    ) {
      where.startTimeHour = series.startTimeHour;
      where.startTimeMinute = series.startTimeMinute;
    }

    const result = await prisma.city_runs.updateMany({
      where,
      data: { runSeriesId: series.id },
    });

    const res = NextResponse.json({
      success: true,
      relinked: result.count,
      seriesId: series.id,
      dayOfWeek: canonicalDay,
    });
    Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[POST /api/run-series/relink-orphans]', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to relink' },
      { status: 500, headers: corsHeaders }
    );
  }
}
