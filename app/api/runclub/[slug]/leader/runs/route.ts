export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { leaderAuthFailureResponse, requireRunClubLeader } from '@/lib/run-club-leader-auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runclub/[slug]/leader/runs
 * Upcoming and recent city runs with RSVP counts for leader management.
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
    const [upcoming, recent] = await Promise.all([
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
        where: { runClubId: auth.club.id, date: { lt: now } },
        orderBy: { date: 'desc' },
        take: 10,
        select: {
          id: true,
          slug: true,
          title: true,
          date: true,
          workflowStatus: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
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
      recent: recent.map((r) => ({ ...r, date: r.date.toISOString() })),
    });
  } catch (error: unknown) {
    console.error('[GET leader runs] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load runs' }, { status: 500 });
  }
}
