export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { prisma } from '@/lib/prisma';
import {
  isCityRunLiveForCheckin,
  isCityRunPast,
  isCityRunWithinPostRunCheckinWindow,
} from '@/lib/city-run-clock';
import { computeAthletePoints } from '@/lib/athlete-points-config';

const CITY_RUN_TYPES = ['CLUB', 'INDIVIDUAL', 'RUN_CREW'] as const;

/** GET /api/me/runner — loyalty door: going runs, live check-in rows, 24h past nags, points */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;
  const nowMs = Date.now();

  try {
    const rsvps = await prisma.city_run_rsvps.findMany({
      where: {
        athleteId: athlete.id,
        status: 'going',
        city_runs: { cityRunType: { in: [...CITY_RUN_TYPES] } },
      },
      include: {
        city_runs: {
          select: {
            id: true,
            title: true,
            date: true,
            citySlug: true,
            startTimeHour: true,
            startTimeMinute: true,
            startTimePeriod: true,
            timezone: true,
            runClubId: true,
            runClub: {
              select: { id: true, slug: true, name: true, logoUrl: true },
            },
            city_run_checkins: {
              where: { athleteId: athlete.id },
              select: { id: true, checkedInAt: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { city_runs: { date: 'asc' } },
      take: 30,
    });

    const goingRuns = rsvps
      .map((r) => {
        const run = r.city_runs;
        const clock = {
          date: run.date,
          startTimeHour: run.startTimeHour,
          startTimeMinute: run.startTimeMinute,
          startTimePeriod: run.startTimePeriod,
          timezone: run.timezone,
        };
        const checkin = run.city_run_checkins[0] ?? null;
        return {
          id: run.id,
          title: run.title,
          date: run.date.toISOString(),
          city: run.citySlug,
          startTimeHour: run.startTimeHour,
          startTimeMinute: run.startTimeMinute,
          startTimePeriod: run.startTimePeriod,
          timezone: run.timezone,
          runClubId: run.runClubId,
          runClub: run.runClub,
          hasCheckin: Boolean(checkin),
          checkedInAt: checkin?.checkedInAt.toISOString() ?? null,
          isPast: isCityRunPast(clock, nowMs),
          isLive: isCityRunLiveForCheckin(clock, nowMs),
          needsWereYouThere:
            !checkin &&
            isCityRunPast(clock, nowMs) &&
            isCityRunWithinPostRunCheckinWindow(clock, nowMs),
        };
      })
      .filter((run) => !run.isPast || run.needsWereYouThere);

    const cityRunScope = {
      city_runs: { cityRunType: { in: [...CITY_RUN_TYPES] } },
    };

    const [rsvpGoingCount, checkinCount] = await Promise.all([
      prisma.city_run_rsvps.count({
        where: { athleteId: athlete.id, status: 'going', ...cityRunScope },
      }),
      prisma.city_run_checkins.count({
        where: { athleteId: athlete.id, ...cityRunScope },
      }),
    ]);

    const points = computeAthletePoints({ rsvpGoingCount, checkinCount });

    return NextResponse.json({
      goingRuns,
      points: {
        total: points.total,
        breakdown: points.breakdown,
        weights: points.weights,
      },
    });
  } catch (err: unknown) {
    console.error('GET /api/me/runner:', err);
    return NextResponse.json(
      { error: 'Server error', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    );
  }
}
