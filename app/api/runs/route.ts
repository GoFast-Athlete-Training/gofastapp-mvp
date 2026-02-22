export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { getRuns } from '@/lib/domain-runs';

/**
 * GET /api/runs
 * 
 * Authenticated endpoint to get CityRuns with optional filters
 * CityRun is a universal run system - can be public (runClubId) or private (runCrewId)
 * 
 * Query params:
 * - gofastCity (optional) - Filter by city slug
 * - day (optional) - Filter by day of week ("Monday", "Tuesday", etc.)
 * - runClubSlug (optional) - Filter by RunClub slug
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

    // For GoFastCompany staff, athlete check is optional
    // Staff users from GoFastCompany don't need to be athletes
    const athlete = await getAthleteByFirebaseId(decodedToken.uid).catch(() => null);
    
    // If not an athlete, allow access anyway (likely GoFastCompany staff)
    // This enables GoFastCompany dashboard to view CityRuns

    // Parse query params
    const { searchParams } = new URL(request.url);
    const gofastCity = searchParams.get('gofastCity') || undefined;
    const day = searchParams.get('day') || undefined;
    const runClubSlug = searchParams.get('runClubSlug') || undefined;
    const includeRunClub = searchParams.get('includeRunClub') === 'true';

    // Get runs with filters
    let runs = await getRuns({ gofastCity, day, runClubSlug });
    
    // Debug logging
    console.log(`[GET /api/runs] Returning ${runs.length} runs`);

    // Hydrate RunClub data if requested (for GoFastCompany dashboard)
    // Note: RunClub is already included via FK relation in getRuns()
    // This is just for backward compatibility
    if (includeRunClub) {
      runs = runs.map((run) => ({
        ...run,
        runClub: run.runClub || null, // Already included via FK
        runClubSlug: run.runClub?.slug || null, // For backward compatibility
      }));
    }

    return NextResponse.json({
      success: true,
      runs,
    });
  } catch (error: any) {
    console.error('Error fetching CityRuns:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch CityRuns', details: error?.message },
      { status: 500 }
    );
  }
}

