export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/athlete/discover/races
 * Races referenced by discoverable athletes (active plan or active goal with race).
 */
export async function GET() {
  try {
    const baseAthlete = {
      gofastHandle: { not: null },
      NOT: { gofastHandle: '' },
    };

    const [fromPlans, fromGoals] = await Promise.all([
      prisma.training_plans.findMany({
        where: {
          lifecycleStatus: 'ACTIVE',
          raceId: { not: null },
          Athlete: baseAthlete,
        },
        select: {
          race_registry: {
            select: {
              id: true,
              name: true,
              distanceLabel: true,
              distanceMeters: true,
              raceDate: true,
              city: true,
              state: true,
              country: true,
            },
          },
        },
      }),
      prisma.athleteGoal.findMany({
        where: {
          status: 'ACTIVE',
          raceRegistryId: { not: null },
          Athlete: baseAthlete,
        },
        select: {
          race_registry: {
            select: {
              id: true,
              name: true,
              distanceLabel: true,
              distanceMeters: true,
              raceDate: true,
              city: true,
              state: true,
              country: true,
            },
          },
        },
      }),
    ]);

    const map = new Map<string, (typeof fromPlans)[0]['race_registry']>();
    for (const row of fromPlans) {
      if (row.race_registry) {
        map.set(row.race_registry.id, row.race_registry);
      }
    }
    for (const row of fromGoals) {
      if (row.race_registry) {
        map.set(row.race_registry.id, row.race_registry);
      }
    }

    const races = Array.from(map.values()).sort((a, b) => {
      const ta = a?.raceDate ? new Date(a.raceDate).getTime() : 0;
      const tb = b?.raceDate ? new Date(b.raceDate).getTime() : 0;
      return ta - tb;
    });

    return NextResponse.json({ success: true, races });
  } catch (e) {
    console.error('GET /api/athlete/discover/races:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
