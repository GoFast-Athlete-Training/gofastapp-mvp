import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_COMPANY_APP_URL || 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/run-series/hydrate-descriptions
 * 
 * Backwards compatibility: Hydrates all run_series.description from run_clubs.allRunsDescription
 * for series that have runClubId FK but null description.
 * 
 * Query params:
 *   - runClubId: (optional) Only hydrate series for this specific club
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const runClubId = url.searchParams.get('runClubId');

    // Find all series with runClubId FK but null description
    const whereClause: any = {
      runClubId: { not: null },
      description: null,
    };
    if (runClubId) {
      whereClause.runClubId = runClubId;
    }

    const seriesNeedingHydration = await prisma.run_series.findMany({
      where: whereClause,
      include: {
        runClub: {
          select: {
            id: true,
            name: true,
            allRunsDescription: true,
          },
        },
      },
    });

    if (seriesNeedingHydration.length === 0) {
      return NextResponse.json({
        success: true,
        hydrated: 0,
        message: 'No series need hydration',
      }, { headers: corsHeaders });
    }

    // Hydrate descriptions from run_clubs.allRunsDescription
    const results = await Promise.allSettled(
      seriesNeedingHydration.map(async (series) => {
        if (!series.runClub?.allRunsDescription) {
          return { id: series.id, name: series.name, hydrated: false, reason: 'Club has no allRunsDescription' };
        }

        await prisma.run_series.update({
          where: { id: series.id },
          data: { description: series.runClub.allRunsDescription },
        });

        return { id: series.id, name: series.name, hydrated: true };
      })
    );

    const hydrated = results.filter((r) => r.status === 'fulfilled' && r.value.hydrated).length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    const skipped = results.filter((r) => r.status === 'fulfilled' && !r.value.hydrated).length;

    return NextResponse.json({
      success: true,
      hydrated,
      failed,
      skipped,
      total: seriesNeedingHydration.length,
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[hydrate-descriptions] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to hydrate descriptions' },
      { status: 500, headers: corsHeaders }
    );
  }
}
