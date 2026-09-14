export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

const corsHeaders = {
  'Access-Control-Allow-Origin':
    process.env.NEXT_PUBLIC_COMPANY_APP_URL ||
    'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/race-registry/unpublish-by-company-race
 * Staff lane: remove catalog rows when Company deletes an editorial race.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }
    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      companyRaceId?: string;
    };
    const companyRaceId = body.companyRaceId?.trim();
    if (!companyRaceId) {
      return NextResponse.json(
        { success: false, error: 'companyRaceId required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await prisma.race_registry.updateMany({
      where: { companyRaceId },
      data: { isActive: false, updatedAt: new Date() },
    });

    return NextResponse.json(
      {
        success: true,
        deactivatedCount: result.count,
      },
      { headers: corsHeaders }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('POST /api/race-registry/unpublish-by-company-race:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to unpublish race registry rows',
        details: err?.message ?? 'Unknown error',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
