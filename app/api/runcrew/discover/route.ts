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
 * - purpose: string[] (optional - Training, Fun, Social)
 * - timePreference: string[] (optional - Morning, Afternoon, Evening)
 * - paceMin: number (optional - DEPRECATED - pace filtering removed with new pace model)
 * - paceMax: number (optional - DEPRECATED - pace filtering removed with new pace model)
 * - gender: string (optional - male, female, both)
 * - ageMin: number (optional)
 * - ageMax: number (optional)
 * - typicalRunMilesMin: number (optional)
 * - typicalRunMilesMax: number (optional)
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
    
    // Parse array params
    const purpose = searchParams.getAll('purpose');
    const timePreference = searchParams.getAll('timePreference');
    
    // Parse number params
    // TODO: Pace filtering removed - new pace model doesn't support min/max filtering
    const gender = searchParams.get('gender') || undefined;
    const ageMin = searchParams.get('ageMin') 
      ? parseInt(searchParams.get('ageMin')!, 10)
      : undefined;
    const ageMax = searchParams.get('ageMax') 
      ? parseInt(searchParams.get('ageMax')!, 10)
      : undefined;
    const typicalRunMilesMin = searchParams.get('typicalRunMilesMin') 
      ? parseFloat(searchParams.get('typicalRunMilesMin')!)
      : undefined;
    const typicalRunMilesMax = searchParams.get('typicalRunMilesMax') 
      ? parseFloat(searchParams.get('typicalRunMilesMax')!)
      : undefined;

    const crews = await getDiscoverableRunCrews({
      limit,
      city,
      state,
      purpose: purpose.length > 0 ? purpose : undefined,
      timePreference: timePreference.length > 0 ? timePreference : undefined,
      gender,
      ageMin,
      ageMax,
      typicalRunMilesMin,
      typicalRunMilesMax,
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

