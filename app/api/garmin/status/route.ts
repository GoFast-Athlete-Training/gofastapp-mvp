export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getGarminConnection } from '@/lib/domain-garmin';

/**
 * GET /api/garmin/status?athleteId=xxx
 * 
 * Check Garmin connection status for an athlete
 */
export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const athleteId = searchParams.get('athleteId');

    if (!athleteId) {
      return NextResponse.json(
        { error: 'athleteId is required' },
        { status: 400 }
      );
    }

    // Get connection status from database
    const connection = await getGarminConnection(athleteId);

    if (!connection) {
      return NextResponse.json({
        connected: false,
        message: 'Athlete not found'
      });
    }

    return NextResponse.json({
      connected: connection.garmin_is_connected || false,
      garminUserId: connection.garmin_user_id,
      connectedAt: connection.garmin_connected_at
    });

  } catch (error: any) {
    console.error('❌ Error checking Garmin status:', error);
    return NextResponse.json(
      { error: 'Failed to check Garmin status', connected: false },
      { status: 500 }
    );
  }
}

