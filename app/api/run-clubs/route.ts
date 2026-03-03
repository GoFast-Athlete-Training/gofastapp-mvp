import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_COMPANY_APP_URL || 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/run-clubs
 *
 * List all run clubs with their series.
 * Called by GoFastCompany via proxy at /api/runclubs.
 */
export async function GET(request: NextRequest) {
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

    const runClubs = await prisma.run_clubs.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        city: true,
        state: true,
        neighborhood: true,
        allRunsDescription: true,
        logoUrl: true,
        runUrl: true,
        runSeries: {
          select: {
            id: true,
            name: true,
            dayOfWeek: true,
          },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    const payload = runClubs.map((club) => ({
      id: club.id,
      name: club.name,
      slug: club.slug,
      city: club.city,
      state: club.state,
      neighborhood: club.neighborhood,
      allRunsDescription: club.allRunsDescription,
      logo: club.logoUrl,
      runUrl: club.runUrl,
      seriesCount: club.runSeries.length,
      series: club.runSeries,
    }));

    const response = NextResponse.json({ success: true, runClubs: payload });
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch (error: any) {
    console.error('[GET /api/run-clubs] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch run clubs' },
      { status: 500, headers: corsHeaders }
    );
  }
}
