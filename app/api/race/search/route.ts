export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const BOSTON_QUALIFIER_TAG = 'boston-qualifier';

const raceSearchSelect = {
  id: true,
  name: true,
  distanceLabel: true,
  distanceMeters: true,
  raceDate: true,
  city: true,
  state: true,
  country: true,
  registrationUrl: true,
  tags: true,
  startTime: true,
  logoUrl: true,
  slug: true,
} satisfies Prisma.race_registrySelect;

async function searchRaces(
  where: Prisma.race_registryWhereInput,
  take: number,
  order: 'asc' | 'desc' = 'asc'
) {
  return prisma.race_registry.findMany({
    where,
    select: raceSearchSelect,
    take,
    orderBy: { raceDate: order },
  });
}

function parseDateParam(s: string | null): Date | null {
  if (!s?.trim()) return null;
  const d = new Date(s.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/** GET /api/race/search — browse & filter upcoming catalog */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const upcoming = searchParams.get('upcoming') === 'true';
    const pastWindow = searchParams.get('pastWindow') === 'true';
    const city = searchParams.get('city')?.trim() || '';
    const bostonQualifier = searchParams.get('bostonQualifier') === 'true';
    const dateFrom = parseDateParam(searchParams.get('dateFrom'));
    const dateTo = parseDateParam(searchParams.get('dateTo'));

    const hasQ = Boolean(q?.trim());
    const hasCity = Boolean(city);
    const hasDateFilter = dateFrom != null || dateTo != null;

    if (pastWindow && upcoming) {
      return NextResponse.json(
        {
          success: false,
          error: 'Use either upcoming=true or pastWindow=true, not both',
        },
        { status: 400 }
      );
    }

    if (!upcoming && !hasQ && !hasCity && !bostonQualifier && !hasDateFilter && !pastWindow) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Provide upcoming=true, pastWindow=true, and/or q=, city=, bostonQualifier=true, dateFrom=/dateTo=',
        },
        { status: 400 }
      );
    }

    const now = new Date();
    let gte: Date | undefined;
    let lte: Date | undefined;
    let pastLt: Date | undefined;

    if (pastWindow) {
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      pastLt = startOfToday;
      const ninetyDaysAgo = new Date(startOfToday);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      gte = ninetyDaysAgo;
      if (dateFrom != null) {
        gte = new Date(Math.max(gte.getTime(), dateFrom.getTime()));
      }
    } else {
      if (upcoming) {
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        gte = startOfToday;
      }
      if (dateFrom != null) {
        gte = gte ? new Date(Math.max(gte.getTime(), dateFrom.getTime())) : dateFrom;
      }
      if (dateTo != null) {
        lte = dateTo;
      }
    }

    const raceDateFilter: Prisma.DateTimeFilter = {};
    if (pastWindow && pastLt != null) {
      if (gte != null) raceDateFilter.gte = gte;
      raceDateFilter.lt = pastLt;
    } else {
      if (gte != null) raceDateFilter.gte = gte;
      if (lte != null) raceDateFilter.lte = lte;
    }

    const where: Prisma.race_registryWhereInput = {
      isActive: true,
      isCancelled: false,
      ...(Object.keys(raceDateFilter).length > 0 ? { raceDate: raceDateFilter } : {}),
      ...(hasQ ? { name: { contains: q!.trim(), mode: 'insensitive' } } : {}),
      ...(hasCity ? { city: { contains: city, mode: 'insensitive' } } : {}),
      ...(bostonQualifier ? { tags: { has: BOSTON_QUALIFIER_TAG } } : {}),
    };

    const take = Math.min(
      200,
      pastWindow
        ? 80
        : upcoming && !hasQ && !hasCity && !bostonQualifier && !hasDateFilter
          ? 100
          : 80
    );
    const order = pastWindow ? 'desc' : 'asc';
    const races = await searchRaces(where, take, order);

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

/** POST /api/race/search — legacy body { query } (GoalSetter, runcrew, etc.) */
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
        isActive: true,
        isCancelled: false,
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
