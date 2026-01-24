export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runcrew/races
 * 
 * Public endpoint to get races (by name) that have groups training for them.
 * No authentication required.
 * 
 * Returns:
 * {
 *   success: true,
 *   races: [
 *     {
 *       id: string,
 *       name: string,
 *       raceType: string,
 *       distanceMiles: number,
 *       raceDate: Date,
 *       city: string | null,
 *       state: string | null,
 *       country: string | null
 *     }
 *   ]
 * }
 */
export async function GET(request: Request) {
  try {
    // Get races that have groups training for them
    const crewsWithRaces = await prisma.run_crews.findMany({
      where: {
        archivedAt: null,
        trainingForRace: { not: null },
      },
      select: {
        trainingForRace: true,
        race_registry: {
          select: {
            id: true,
            name: true,
            raceType: true,
            distanceMiles: true,
            raceDate: true,
            city: true,
            state: true,
            country: true,
          },
        },
      },
    });

    // Extract unique races
    const raceMap = new Map<string, any>();
    crewsWithRaces.forEach((crew) => {
      if (crew.race_registry) {
        raceMap.set(crew.race_registry.id, crew.race_registry);
      }
    });

    // Convert to array and sort by date (upcoming first)
    const races = Array.from(raceMap.values()).sort((a, b) => {
      const dateA = a.raceDate ? new Date(a.raceDate).getTime() : 0;
      const dateB = b.raceDate ? new Date(b.raceDate).getTime() : 0;
      return dateA - dateB;
    });

    return NextResponse.json({
      success: true,
      races,
    });
  } catch (err) {
    console.error('Error fetching races:', err);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}




