export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { getRuns } from '@/lib/domain-runs';

/**
 * GET /api/runs
 * 
 * Authenticated endpoint to get runs with optional filters
 * 
 * Query params:
 * - citySlug (optional) - Filter by city slug
 * - day (optional) - Filter by day of week ("Monday", "Tuesday", etc.)
 * 
 * Returns:
 * {
 *   success: true,
 *   runs: [...]
 * }
 */
export async function GET(request: Request) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify athlete exists
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const citySlug = searchParams.get('citySlug') || undefined;
    const day = searchParams.get('day') || undefined;

    // Get runs with filters
    const runs = await getRuns({ citySlug, day });

    return NextResponse.json({
      success: true,
      runs,
    });
  } catch (error: any) {
    console.error('Error fetching runs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch runs', details: error?.message },
      { status: 500 }
    );
  }
}

