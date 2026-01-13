export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runcrew/race-locations
 * 
 * Public endpoint to get states and cities for race filtering.
 * No authentication required.
 * 
 * Query params:
 * - raceId: string (optional - filter by race ID)
 * 
 * Returns:
 * {
 *   success: true,
 *   states: ['CA', 'NY', ...],
 *   citiesByState: { 'CA': ['Los Angeles', 'San Francisco', ...], ... }
 * }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raceId = searchParams.get('raceId') || undefined;

    // Build where clause
    const where: any = {
      archivedAt: null,
      trainingForRace: { not: null },
    };

    // If raceId is provided, filter by it
    if (raceId) {
      where.trainingForRace = raceId;
    }

    // Get crews with races
    const crews = await prisma.run_crews.findMany({
      where,
      select: {
        state: true,
        city: true,
        race_registry: {
          select: {
            raceType: true,
            state: true,
            city: true,
          },
        },
      },
    });

    // Extract unique states and cities
    const statesSet = new Set<string>();
    const citiesByState: { [state: string]: Set<string> } = {};

    crews.forEach((crew) => {
      // Use race location if available, otherwise use crew location
      const state = crew.race_registry?.state || crew.state;
      const city = crew.race_registry?.city || crew.city;

      if (state) {
        statesSet.add(state);
        if (!citiesByState[state]) {
          citiesByState[state] = new Set();
        }
        if (city) {
          citiesByState[state].add(city);
        }
      }
    });

    // Convert sets to sorted arrays
    const states = Array.from(statesSet).sort();
    const citiesByStateArray: { [state: string]: string[] } = {};
    Object.keys(citiesByState).forEach((state) => {
      citiesByStateArray[state] = Array.from(citiesByState[state]).sort();
    });

    return NextResponse.json({
      success: true,
      states,
      citiesByState: citiesByStateArray,
    });
  } catch (err) {
    console.error('Error fetching race locations:', err);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}

