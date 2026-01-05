export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDiscoverableRunCrews } from '@/lib/domain-runcrew';

/**
 * GET /api/runcrew/discover
 * 
 * Public endpoint to discover runcrews.
 * No authentication required - returns public information for discovery.
 * 
 * Query params:
 * - limit: number (default 50)
 * - city: string (optional filter)
 * - state: string (optional filter)
 * 
 * Returns:
 * {
 *   success: true,
 *   runCrews: [
 *     {
 *       id: string,
 *       name: string,
 *       description: string | null,
 *       logo: string | null,
 *       icon: string | null,
 *       city: string | null,
 *       state: string | null,
 *       paceRange: string | null,
 *       gender: string | null,
 *       ageRange: string | null,
 *       primaryMeetUpPoint: string | null,
 *       primaryMeetUpAddress: string | null,
 *       purpose: string[] | null,
 *       timePreference: string[] | null,
 *       typicalRunMiles: number | null,
 *       memberCount: number,
 *       createdAt: Date
 *     }
 *   ]
 * }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const limit = searchParams.get('limit') 
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined;
    const city = searchParams.get('city') || undefined;
    const state = searchParams.get('state') || undefined;

    const crews = await getDiscoverableRunCrews({
      limit,
      city,
      state,
    });

    return NextResponse.json({
      success: true,
      runCrews: crews,
    });
  } catch (err) {
    console.error('Error fetching discoverable runcrews:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

