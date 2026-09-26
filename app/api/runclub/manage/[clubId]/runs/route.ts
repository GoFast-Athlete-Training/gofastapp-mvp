export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  COMPLETED_RUN_FEED_DAYS,
  completedRunFeedWindowStart,
  formatCompletedRunFeedItem,
} from '@/lib/runclub/completed-run-feed';
import { createCityRunForClubLeader } from '@/lib/club-manager-create-run';
import { assertStaffClubManage, resolveClubAuthorAthleteId } from '@/lib/run-club-staff-manage-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    const auth = await assertStaffClubManage(request, clubId);
    if (auth.error) return auth.error;

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
    console.error('[GET staff manage runs]', error);
    return NextResponse.json({ success: false, error: 'Failed to load runs' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    const auth = await assertStaffClubManage(request, clubId);
    if (auth.error) return auth.error;

    const body = (await request.json()) as {
      title?: string;
      date?: string;
      meetUpPoint?: string;
      meetUpCity?: string | null;
      meetUpState?: string | null;
      description?: string | null;
      totalMiles?: number | string | null;
      pace?: string | null;
    };

    const athleteGeneratedId = await resolveClubAuthorAthleteId(auth.club.id);

    const run = await createCityRunForClubLeader({
      runClubId: auth.club.id,
      athleteGeneratedId,
      input: {
        title: body.title ?? '',
        date: body.date ?? '',
        meetUpPoint: body.meetUpPoint ?? '',
        meetUpCity: body.meetUpCity,
        meetUpState: body.meetUpState,
        description: body.description,
        totalMiles: body.totalMiles,
        pace: body.pace,
      },
    });

    return NextResponse.json({ success: true, run });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create run';
    console.error('[POST staff manage runs]', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
