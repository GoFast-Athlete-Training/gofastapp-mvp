export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDiscoverableRunCrews } from '@/lib/domain-runcrew';

/**
 * GET /api/runcrew/discover
 * 
 * Public endpoint to discover runcrews.
 * No authentication required - returns public information for discovery.
 * 
 * Query params (MVP):
 * - limit: number (default 50)
 * - search: string (optional - search by crew name only)
 * - city: string (optional filter)
 * - state: string (optional filter)
 * - purpose: string[] (optional - Training, Social, General Fitness)
 * - trainingForRace: string (optional - race ID to filter by specific race)
 * - raceTrainingGroups: boolean (optional - true = only crews training for a race)
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
    const search = searchParams.get('search') || undefined;
    const city = searchParams.get('city') || undefined;
    const state = searchParams.get('state') || undefined;
    
    // Parse array params
    const purpose = searchParams.getAll('purpose');
    
    // Training for Race filter (race ID) - deprecated, use raceType instead
    const trainingForRace = searchParams.get('trainingForRace') || undefined;
    
    // Race Training Groups filter (boolean) - deprecated, use raceType instead
    const raceTrainingGroupsParam = searchParams.get('raceTrainingGroups');
    const raceTrainingGroups = raceTrainingGroupsParam === 'true' ? true : undefined;

    // Race filtering (by race name/ID)
    const raceId = searchParams.get('raceId') || undefined;
    const raceCity = searchParams.get('raceCity') || undefined;
    const raceState = searchParams.get('raceState') || undefined;

    const crews = await getDiscoverableRunCrews({
      limit,
      search,
      city,
      state,
      purpose: purpose.length > 0 ? purpose : undefined,
      trainingForRace: raceId || trainingForRace, // Use raceId if provided, fallback to trainingForRace
      raceTrainingGroups,
      raceCity,
      raceState,
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

