export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteById } from '@/lib/domain-athlete';
import { getAthleteEngagement } from '@/lib/engagement';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/company/users/[id]/engagement-summary
 *
 * HQ engagement counts for a single athlete — cheap counts from existing tables
 * plus pre-computed mileage snapshot on Athlete.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing user id' },
        { status: 400, headers: corsHeaders }
      );
    }

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

    const athlete = await getAthleteById(id);
    if (!athlete) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const engagement = await getAthleteEngagement(id);
    if (!engagement) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const conversionRate =
      engagement.runsRsvpdGoing.lifetime > 0
        ? engagement.runsAttended.lifetime / engagement.runsRsvpdGoing.lifetime
        : null;

    return NextResponse.json(
      {
        success: true,
        engagement: {
          ...engagement,
          conversionRate,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('[GET /api/company/users/[id]/engagement-summary] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error', details: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
