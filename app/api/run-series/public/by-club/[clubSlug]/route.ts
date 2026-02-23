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
 * GET /api/run-series/public/by-club/[clubSlug]
 *
 * Public (no auth) — returns all published run_series for a club,
 * keyed by dayOfWeek. Used by the public club page to resolve
 * "See Details" links for each schedule slot.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clubSlug: string }> }
) {
  try {
    const { clubSlug } = await params;

    const club = await prisma.run_clubs.findUnique({
      where: { slug: clubSlug },
      select: { id: true },
    });

    // No 404: club may exist in content-public but not yet in product run_clubs; return empty so UI shows "coming soon"
    if (!club) {
      return NextResponse.json(
        { success: true, byDay: {} },
        { headers: corsHeaders }
      );
    }

    const series = await prisma.run_series.findMany({
      where: {
        runClubId: club.id,
        slug: { not: null },
        workflowStatus: { in: ['PENDING', 'SUBMITTED', 'APPROVED'] },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        dayOfWeek: true,
      },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Return as a map: dayOfWeek → { id, slug, name }
    const byDay: Record<string, { id: string; slug: string; name: string | null }> = {};
    for (const s of series) {
      if (s.slug) byDay[s.dayOfWeek] = { id: s.id, slug: s.slug, name: s.name };
    }

    return NextResponse.json(
      { success: true, byDay },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[GET /api/run-series/public/by-club/[clubSlug]] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch series', details: error?.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
