export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runcrew/locations
 * 
 * Returns available cities and states from existing non-archived run crews.
 * Used to populate location filter dropdowns.
 */
export async function GET() {
  try {
    // Get distinct cities and states from non-archived crews
    const crews = await prisma.run_crews.findMany({
      where: {
        archivedAt: null,
      },
      select: {
        city: true,
        state: true,
      },
      distinct: ['city', 'state'],
    });

    // Extract unique states
    const states = Array.from(
      new Set(
        crews
          .map((crew) => crew.state)
          .filter((state): state is string => state !== null && state.trim() !== '')
          .sort()
      )
    );

    // Group cities by state for conditional filtering
    const citiesByState: { [state: string]: string[] } = {};
    crews.forEach((crew) => {
      if (crew.city && crew.state) {
        if (!citiesByState[crew.state]) {
          citiesByState[crew.state] = [];
        }
        if (!citiesByState[crew.state].includes(crew.city)) {
          citiesByState[crew.state].push(crew.city);
        }
      }
    });

    // Sort cities within each state
    Object.keys(citiesByState).forEach((state) => {
      citiesByState[state].sort();
    });

    return NextResponse.json({
      success: true,
      states,
      citiesByState,
    });
  } catch (err) {
    console.error('Error fetching runcrew locations:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

