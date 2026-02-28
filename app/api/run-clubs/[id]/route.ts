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
 * GET /api/run-clubs/[id]
 * 
 * Fetch a run club with all its run_series (backwards compatible hydration)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const runClub = await prisma.run_clubs.findUnique({
      where: { id },
      include: {
        runSeries: {
          select: {
            id: true,
            slug: true,
            name: true,
            dayOfWeek: true,
            description: true,
            workflowStatus: true,
            startTimeHour: true,
            startTimeMinute: true,
            startTimePeriod: true,
            meetUpPoint: true,
            meetUpCity: true,
          },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    if (!runClub) {
      return NextResponse.json(
        { success: false, error: 'Run club not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const response = NextResponse.json({
      success: true,
      runClub: {
        ...runClub,
        runSeries: runClub.runSeries || [],
      },
    });
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch (error: any) {
    console.error('[run-clubs GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch run club' },
      { status: 500, headers: corsHeaders }
    );
  }
}
