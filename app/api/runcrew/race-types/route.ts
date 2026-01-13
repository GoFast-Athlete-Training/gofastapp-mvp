export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runcrew/race-types
 * 
 * Public endpoint to get distinct race types that have groups training for them.
 * No authentication required.
 * 
 * Returns:
 * {
 *   success: true,
 *   raceTypes: ['5k', '10k', 'half', 'marathon', ...]
 * }
 */
export async function GET(request: Request) {
  try {
    // Get distinct race types from groups that are training for a race
    const crewsWithRaces = await prisma.run_crews.findMany({
      where: {
        archivedAt: null,
        trainingForRace: { not: null },
      },
      select: {
        race_registry: {
          select: {
            raceType: true,
          },
        },
      },
    });

    // Extract unique race types
    const raceTypes = Array.from(
      new Set(
        crewsWithRaces
          .map((crew) => crew.race_registry?.raceType)
          .filter((type): type is string => !!type)
      )
    ).sort();

    return NextResponse.json({
      success: true,
      raceTypes,
    });
  } catch (err) {
    console.error('Error fetching race types:', err);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}

