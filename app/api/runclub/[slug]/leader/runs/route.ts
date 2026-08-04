export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { leaderAuthFailureResponse, requireRunClubLeader } from '@/lib/run-club-leader-auth';
import { prisma } from '@/lib/prisma';
import {
  COMPLETED_RUN_FEED_DAYS,
  completedRunFeedWindowStart,
  formatCompletedRunFeedItem,
} from '@/lib/runclub/completed-run-feed';

/**
 * GET /api/runclub/[slug]/leader/runs
 * Upcoming and recent city runs for leader management (incl. post-run publish).
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

    const now = new Date();
    const windowStart = completedRunFeedWindowStart(now);

    const [upcoming, completed] = await Promise.all([
      prisma.city_runs.findMany({
        where: { runClubId: auth.club.id, date: { gte: now } },
        orderBy: { date: 'asc' },
        take: 30,
        include: {
          city_run_rsvps: {
            where: { status: 'going' },
            include: {
              Athlete: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      }),
      prisma.city_runs.findMany({
        where: {
          runClubId: auth.club.id,
          date: { lt: now, gte: windowStart },
        },
        orderBy: { date: 'desc' },
        take: 30,
        select: {
          id: true,
          slug: true,
          title: true,
          date: true,
          workflowStatus: true,
          meetUpPoint: true,
          postRunNote: true,
          postRunPhotoUrl: true,
          postRunPublished: true,
          postRunPublishedAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      completedWindowDays: COMPLETED_RUN_FEED_DAYS,
      upcoming: upcoming.map((run) => ({
        id: run.id,
        slug: run.slug,
        title: run.title,
        date: run.date.toISOString(),
        workflowStatus: run.workflowStatus,
        meetUpPoint: run.meetUpPoint,
        startTimeHour: run.startTimeHour,
        startTimeMinute: run.startTimeMinute,
        startTimePeriod: run.startTimePeriod,
        rsvps: run.city_run_rsvps.map((r) => ({
          id: r.id,
          status: r.status,
          athlete: r.Athlete,
        })),
      })),
      completed: completed.map((r) => ({
        ...formatCompletedRunFeedItem(r),
        workflowStatus: r.workflowStatus,
        postRunPublished: r.postRunPublished,
      })),
    });
  } catch (error: unknown) {
    console.error('[GET leader runs] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load runs' }, { status: 500 });
  }
}
