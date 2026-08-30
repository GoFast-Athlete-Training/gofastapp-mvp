export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { prisma } from '@/lib/prisma';
import {
  activityHistoryInclude,
  buildActivityHistoryWhere,
  decodeActivityHistoryCursor,
  encodeActivityHistoryCursor,
  mapActivityHistoryRow,
  parseActivityHistoryDate,
  parseActivityHistoryFilter,
  parseActivityHistoryLimit,
} from '@/lib/activities/activity-history';

/**
 * GET /api/activities
 *
 * Canonical authenticated activity history stream.
 * Query: limit, cursor, from, to, filter=all|unmatched
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseActivityHistoryLimit(searchParams.get('limit'));
    const filter = parseActivityHistoryFilter(searchParams.get('filter'));
    const from = parseActivityHistoryDate(searchParams.get('from'));
    const to = parseActivityHistoryDate(searchParams.get('to'));
    const cursor = decodeActivityHistoryCursor(searchParams.get('cursor'));

    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rows = await prisma.athlete_activities.findMany({
      where: buildActivityHistoryWhere({
        athleteId: auth.athlete.id,
        filter,
        from,
        to,
        cursor,
      }),
      orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        sourceActivityId: true,
        source: true,
        ingestionStatus: true,
        activityType: true,
        activityName: true,
        startTime: true,
        duration: true,
        distance: true,
        calories: true,
        averageSpeed: true,
        averageHeartRate: true,
        elevationGain: true,
        ...activityHistoryInclude,
      },
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const items = pageRows.map((row) => mapActivityHistoryRow(row));
    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && lastRow?.startTime ? encodeActivityHistoryCursor(lastRow) : null;

    return NextResponse.json({
      items,
      activities: items,
      nextCursor,
      hasMore,
    });
  } catch (error: unknown) {
    console.error('❌ GET /api/activities:', error);
    return NextResponse.json(
      {
        error: 'Failed to load activities',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
