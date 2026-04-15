export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/athlete/discover/locations
 * Distinct city/state from athletes with a public handle (for find-runners filters).
 */
export async function GET() {
  try {
    const rows = await prisma.athlete.findMany({
      where: {
        gofastHandle: { not: null },
        NOT: { gofastHandle: '' },
        state: { not: null },
      },
      select: {
        city: true,
        state: true,
      },
      distinct: ['city', 'state'],
    });

    const states = Array.from(
      new Set(
        rows
          .map((r) => r.state)
          .filter((s): s is string => s !== null && s !== '')
          .sort()
      )
    );

    const citiesByState: Record<string, string[]> = {};
    rows.forEach((r) => {
      if (r.state && r.city) {
        const sk = r.state;
        if (!citiesByState[sk]) citiesByState[sk] = [];
        if (!citiesByState[sk].includes(r.city)) {
          citiesByState[sk].push(r.city);
        }
      }
    });
    Object.keys(citiesByState).forEach((s) => {
      citiesByState[s].sort();
    });

    return NextResponse.json({
      success: true,
      states,
      citiesByState,
    });
  } catch (e) {
    console.error('GET /api/athlete/discover/locations:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
