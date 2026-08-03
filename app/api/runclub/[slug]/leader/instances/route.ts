export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { leaderAuthFailureResponse, requireRunClubLeader } from '@/lib/run-club-leader-auth';
import {
  advanceClubInstances,
  resolveClubInstanceLanes,
  type InstanceLane,
} from '@/lib/advance-club-instances';
import { prisma } from '@/lib/prisma';

type SeriesMeta = {
  id: string;
  name: string | null;
  dayOfWeek: string;
  slug: string | null;
};

function formatDayLabel(dayOfWeek: string): string {
  const lower = dayOfWeek.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function seriesLabel(series: SeriesMeta | undefined, lane: InstanceLane): string {
  if (series?.name?.trim()) return series.name.trim();
  if (series?.dayOfWeek) return `${formatDayLabel(series.dayOfWeek)} run`;
  if (lane.latestPriorRun?.title) return lane.latestPriorRun.title;
  return `Series ${lane.runSeriesId.slice(0, 8)}`;
}

/**
 * GET /api/runclub/[slug]/leader/instances
 * Weekly series lanes: next instance, history, and whether reuse/advance is needed.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const auth = await requireRunClubLeader(request, { slug });
    if ('error' in auth) {
      return leaderAuthFailureResponse(auth);
    }

    const [lanes, seriesRows] = await Promise.all([
      resolveClubInstanceLanes(auth.club.id),
      prisma.run_series.findMany({
        where: { runClubId: auth.club.id },
        select: { id: true, name: true, dayOfWeek: true, slug: true },
      }),
    ]);

    const seriesById = new Map(seriesRows.map((s) => [s.id, s]));

    return NextResponse.json({
      success: true,
      runClubId: auth.club.id,
      lanes: lanes.map((lane) => {
        const series = seriesById.get(lane.runSeriesId);
        return {
          ...lane,
          seriesLabel: seriesLabel(series, lane),
          dayOfWeek: series?.dayOfWeek ?? null,
          seriesSlug: series?.slug ?? null,
        };
      }),
      needsAdvanceCount: lanes.filter((l) => l.needsAdvance).length,
    });
  } catch (error) {
    console.error('[GET leader instances]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load series lanes' },
      { status: 500 }
    );
  }
}

type AdvanceBody = {
  runSeriesIds?: string[];
};

/**
 * POST /api/runclub/[slug]/leader/instances
 * Reuse last run — duplicate latest prior city_run forward 7 days per series lane.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const auth = await requireRunClubLeader(request, { slug });
    if ('error' in auth) {
      return leaderAuthFailureResponse(auth);
    }

    const body = (await request.json().catch(() => ({}))) as AdvanceBody;
    const runSeriesIds = Array.isArray(body.runSeriesIds)
      ? body.runSeriesIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : undefined;

    const results = await advanceClubInstances({
      runClubId: auth.club.id,
      staffGeneratedId: auth.athlete.id,
      runSeriesIds,
    });

    const created = results.filter((r) => r.outcome === 'created').length;
    const found = results.filter((r) => r.outcome === 'found_existing').length;
    const errors = results.filter((r) => r.outcome === 'error').length;

    return NextResponse.json({
      success: errors === 0,
      runClubId: auth.club.id,
      created,
      found,
      skipped: results.filter((r) => r.outcome === 'skipped_no_prior').length,
      errorCount: errors,
      results,
    });
  } catch (error) {
    console.error('[POST leader instances]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to advance run instances' },
      { status: 500 }
    );
  }
}
