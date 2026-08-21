export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { goalAthleteRaceSelect } from '@/lib/goal-race-display';

type DiscoverRace = {
  id: string;
  name: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  raceDate: Date | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

function athleteRaceToDiscoverRace(
  row: {
    raceRegistryId: string;
    name: string;
    distanceLabel: string | null;
    distanceMeters: number | null;
    raceDate: Date;
    city: string | null;
    state: string | null;
  },
  country: string | null = null
): DiscoverRace {
  return {
    id: row.raceRegistryId,
    name: row.name,
    distanceLabel: row.distanceLabel,
    distanceMeters: row.distanceMeters,
    raceDate: row.raceDate,
    city: row.city,
    state: row.state,
    country,
  };
}

/**
 * GET /api/athlete/discover/races
 * Races referenced by GoFast With Me athletes (active plan or active goal with race).
 */
export async function GET() {
  try {
    const baseAthlete = {
      gofastHandle: { not: null },
      NOT: { gofastHandle: '' },
      isGoFastContainer: true,
    };

    const [fromPlans, fromRaces] = await Promise.all([
      prisma.training_plans.findMany({
        where: {
          lifecycleStatus: 'ACTIVE',
          OR: [{ raceId: { not: null } }, { athleteRaceId: { not: null } }],
          Athlete: baseAthlete,
        },
        select: {
          athlete_race: { select: goalAthleteRaceSelect },
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
      prisma.athlete_races.findMany({
        where: {
          goalTime: { not: null },
          Athlete: baseAthlete,
        },
        select: {
          raceRegistryId: true,
          name: true,
          distanceLabel: true,
          distanceMeters: true,
          raceDate: true,
          city: true,
          state: true,
        },
      }),
    ]);

    const map = new Map<string, DiscoverRace>();
    for (const row of fromPlans) {
      if (row.athlete_race) {
        map.set(
          row.athlete_race.raceRegistryId,
          athleteRaceToDiscoverRace(row.athlete_race, null)
        );
      } else if (row.race_registry) {
        map.set(row.race_registry.id, row.race_registry);
      }
    }
    for (const row of fromRaces) {
      map.set(row.raceRegistryId, athleteRaceToDiscoverRace(row, null));
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
