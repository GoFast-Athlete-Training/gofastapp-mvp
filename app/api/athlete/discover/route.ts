export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { DiscoverRunnerCard } from '@/lib/find-runners-types';
import { goalAthleteRaceSelect } from '@/lib/goal-race-display';

type GoalRaceSnapshot = {
  raceRegistryId: string;
  name: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  raceDate: Date;
};

function pickDisplayRace(
  plan: {
    raceId: string | null;
    athlete_race: GoalRaceSnapshot | null;
    race_registry: {
      id: string;
      name: string;
      distanceLabel: string | null;
      distanceMeters: number | null;
      raceDate: Date | null;
    } | null;
  } | null,
  goal: {
    goalTime: string | null;
    athlete_race: GoalRaceSnapshot | null;
  } | null
): { race: DiscoverRunnerCard['race']; goalTime: string | null } {
  const planRace = plan?.athlete_race
    ? {
        id: plan.athlete_race.raceRegistryId,
        name: plan.athlete_race.name,
        distanceLabel: plan.athlete_race.distanceLabel,
        distanceMeters: plan.athlete_race.distanceMeters,
        raceDate: plan.athlete_race.raceDate,
      }
    : plan?.race_registry;

  if (planRace) {
    const goalRaceId = goal?.athlete_race?.raceRegistryId ?? null;
    const goalTime =
      goalRaceId === planRace.id && goal?.goalTime ? goal.goalTime : null;
    return {
      race: {
        id: planRace.id,
        name: planRace.name,
        distanceLabel: planRace.distanceLabel,
        distanceMeters: planRace.distanceMeters,
        raceDate: planRace.raceDate ? planRace.raceDate.toISOString() : null,
      },
      goalTime,
    };
  }

  if (goal?.athlete_race) {
    const r = goal.athlete_race;
    return {
      race: {
        id: r.raceRegistryId,
        name: r.name,
        distanceLabel: r.distanceLabel,
        distanceMeters: r.distanceMeters,
        raceDate: r.raceDate.toISOString(),
      },
      goalTime: goal.goalTime ?? null,
    };
  }

  return { race: null, goalTime: goal?.goalTime ?? null };
}

/**
 * GET /api/athlete/discover
 * Public. Athletes opted into GoFast With Me (isGoFastContainer) with a handle;
 * optional filters by race, state, city.
 * Query: page, limit, q, raceId, state, city
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limitRaw = parseInt(searchParams.get('limit') || '20', 10) || 20;
    const limit = Math.min(50, Math.max(1, limitRaw));
    const skip = (page - 1) * limit;

    const raceId = searchParams.get('raceId')?.trim() || '';
    const state = searchParams.get('state')?.trim() || '';
    const city = searchParams.get('city')?.trim() || '';
    const q = searchParams.get('q')?.trim().replace(/^@/, '') || '';

    const baseWhere = {
      gofastHandle: { not: null },
      NOT: { gofastHandle: '' },
      isGoFastContainer: true,
    };

    const andParts: object[] = [];
    if (q) {
      andParts.push({
        OR: [
          { gofastHandle: { contains: q, mode: 'insensitive' as const } },
          { firstName: { contains: q, mode: 'insensitive' as const } },
          { lastName: { contains: q, mode: 'insensitive' as const } },
        ],
      });
    }
    if (state) {
      andParts.push({ state });
    }
    if (city) {
      andParts.push({ city });
    }
    if (raceId) {
      andParts.push({
        OR: [
          {
            training_plans: {
              some: {
                lifecycleStatus: 'ACTIVE' as const,
                OR: [
                  { raceId },
                  { athlete_race: { is: { raceRegistryId: raceId } } },
                ],
              },
            },
          },
          {
            athlete_goals: {
              some: {
                status: 'ACTIVE',
                athlete_race: { is: { raceRegistryId: raceId } },
              },
            },
          },
        ],
      });
    }

    const where =
      andParts.length > 0
        ? { ...baseWhere, AND: andParts }
        : baseWhere;

    const [total, athletes] = await Promise.all([
      prisma.athlete.count({ where }),
      prisma.athlete.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          gofastHandle: true,
          firstName: true,
          lastName: true,
          photoURL: true,
          city: true,
          state: true,
          fiveKPace: true,
          training_plans: {
            where: { lifecycleStatus: 'ACTIVE' },
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: {
              raceId: true,
              athlete_race: { select: goalAthleteRaceSelect },
              race_registry: {
                select: {
                  id: true,
                  name: true,
                  distanceLabel: true,
                  distanceMeters: true,
                  raceDate: true,
                },
              },
            },
          },
          athlete_goals: {
            where: { status: 'ACTIVE' },
            orderBy: { targetByDate: 'asc' },
            take: 1,
            select: {
              goalTime: true,
              athlete_race: { select: goalAthleteRaceSelect },
            },
          },
        },
      }),
    ]);

    const now = new Date();
    const ids = athletes.map((a) => a.id);

    const upcomingRuns =
      ids.length === 0
        ? []
        : await prisma.city_runs.findMany({
            where: {
              athleteGeneratedId: { in: ids },
              date: { gte: now },
              published: true,
            },
            orderBy: { date: 'asc' },
            select: {
              id: true,
              athleteGeneratedId: true,
              title: true,
              date: true,
              meetUpPoint: true,
              citySlug: true,
            },
          });

    const nextRunByAthlete = new Map<string, (typeof upcomingRuns)[0]>();
    for (const run of upcomingRuns) {
      const aid = run.athleteGeneratedId;
      if (!aid) continue;
      if (!nextRunByAthlete.has(aid)) {
        nextRunByAthlete.set(aid, run);
      }
    }

    const runners: DiscoverRunnerCard[] = athletes.map((a) => {
      const plan = a.training_plans[0] ?? null;
      const goal = a.athlete_goals[0] ?? null;
      const { race, goalTime } = pickDisplayRace(plan, goal);

      const nr = nextRunByAthlete.get(a.id);
      let nextRun: DiscoverRunnerCard['nextRun'] = null;
      if (nr) {
        nextRun = {
          id: nr.id,
          title: nr.title,
          date: nr.date.toISOString(),
          meetUpPoint: nr.meetUpPoint,
          citySlug: nr.citySlug,
          gorunPath: `/gorun/${nr.id}`,
        };
      }

      return {
        athleteId: a.id,
        gofastHandle: a.gofastHandle as string,
        firstName: a.firstName,
        lastName: a.lastName,
        photoURL: a.photoURL,
        city: a.city,
        state: a.state,
        fiveKPace: a.fiveKPace,
        race,
        goalTime,
        nextRun,
      };
    });

    return NextResponse.json({
      success: true,
      runners,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: skip + runners.length < total,
      },
    });
  } catch (e: unknown) {
    console.error('GET /api/athlete/discover:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
