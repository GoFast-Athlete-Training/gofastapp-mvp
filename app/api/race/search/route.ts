export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const raceSearchSelect = {
  id: true,
  name: true,
  raceType: true,
  distanceMiles: true,
  raceDate: true,
  city: true,
  state: true,
  country: true,
  registrationUrl: true,
} satisfies Prisma.race_registrySelect;

async function searchRaces(where: Prisma.race_registryWhereInput, take: number) {
  return prisma.race_registry.findMany({
    where,
    select: raceSearchSelect,
    take,
    orderBy: { raceDate: 'asc' },
  });
}

/** GET /api/race/search?q=&upcoming=true — public browse / search */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const upcoming = searchParams.get('upcoming') === 'true';

    if (!upcoming && (!q || !q.trim())) {
      return NextResponse.json(
        { success: false, error: 'Provide q= search text or upcoming=true' },
        { status: 400 }
      );
    }

    const baseFilter: Prisma.race_registryWhereInput = {
      isActive: true,
      isCancelled: false,
    };

    let where: Prisma.race_registryWhereInput = { ...baseFilter };

    if (upcoming) {
      where = {
        ...where,
        raceDate: { gte: new Date() },
      };
    }

    if (q?.trim()) {
      where = {
        ...where,
        name: { contains: q.trim(), mode: 'insensitive' },
      };
    }

    const take = upcoming && !q?.trim() ? 100 : 20;
    const races = await searchRaces(where, take);

    return NextResponse.json({
      success: true,
      race_registry: races,
    });
  } catch (error: unknown) {
    console.error('❌ RACE SEARCH GET: Error:', error);
    const err = error as { code?: string; message?: string };
    if (err.code === 'P2021' || err.message?.includes('does not exist')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Race search is temporarily unavailable',
          details: 'Database table not found.',
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search races',
        details: err?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/** POST /api/race/search — legacy body { query } (RaceGoalEditor, runcrew, etc.) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query string required' },
        { status: 400 }
      );
    }

    const races = await searchRaces(
      {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      20
    );

    return NextResponse.json({
      success: true,
      race_registry: races,
    });
  } catch (error: unknown) {
    console.error('❌ RACE SEARCH POST: Error:', error);
    const err = error as { code?: string; message?: string };

    if (err.code === 'P2021' || err.message?.includes('does not exist')) {
      console.error('❌ RACE SEARCH: race_registry table does not exist');
      return NextResponse.json(
        {
          success: false,
          error: 'Race search is temporarily unavailable',
          details:
            'Database table not found. Please try creating a new race instead.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search races',
        details: err?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
