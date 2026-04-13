export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteById } from '@/lib/domain-athlete';
import { ATHLETE_ID_HEADER } from '@/lib/gofast-request-headers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runclub/[slug]
 *
 * Authenticated. Returns the RunClub container data:
 *  - club identity (name, logo, city, social links)
 *  - upcoming city_runs with per-run RSVP status for the current athlete
 *  - recent city_runs with check-in count, photos, and shouts
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Athlete is optional — RSVP status is hydrated if present
    let athlete: { id: string; firebaseId: string } | null = null;
    const sessionAthleteId = request.headers.get(ATHLETE_ID_HEADER)?.trim();
    if (sessionAthleteId) {
      const byId = await getAthleteById(sessionAthleteId);
      if (byId && byId.firebaseId === decodedToken.uid) {
        athlete = byId;
      }
    }

    const { slug } = await params;

    const club = await prisma.run_clubs.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        city: true,
        state: true,
        neighborhood: true,
        description: true,
        allRunsDescription: true,
        websiteUrl: true,
        instagramUrl: true,
        stravaUrl: true,
      },
    });

    if (!club) {
      return NextResponse.json({ error: 'Run club not found' }, { status: 404 });
    }

    const now = new Date();

    const [upcomingRuns, recentRuns] = await Promise.all([
      // Upcoming: today and future, soonest first
      prisma.city_runs.findMany({
        where: { runClubId: club.id, date: { gte: now } },
        orderBy: { date: 'asc' },
        take: 10,
        select: {
          id: true,
          slug: true,
          title: true,
          date: true,
          dayOfWeek: true,
          meetUpPoint: true,
          meetUpCity: true,
          meetUpState: true,
          startTimeHour: true,
          startTimeMinute: true,
          startTimePeriod: true,
          totalMiles: true,
          pace: true,
          city_run_rsvps: {
            select: { id: true, athleteId: true, status: true },
          },
        },
      }),
      // Recent: past runs, most recent first
      prisma.city_runs.findMany({
        where: { runClubId: club.id, date: { lt: now } },
        orderBy: { date: 'desc' },
        take: 5,
        select: {
          id: true,
          slug: true,
          title: true,
          date: true,
          dayOfWeek: true,
          meetUpPoint: true,
          city_run_checkins: {
            select: {
              id: true,
              athleteId: true,
              runPhotoUrl: true,
              runShouts: true,
              checkedInAt: true,
              Athlete: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  photoURL: true,
                },
              },
            },
            orderBy: { checkedInAt: 'asc' },
          },
        },
      }),
    ]);

    const upcomingFormatted = upcomingRuns.map((run) => {
      const goingRsvps = run.city_run_rsvps.filter((r) => r.status === 'going');
      const myRsvp = athlete
        ? run.city_run_rsvps.find((r) => r.athleteId === athlete!.id)
        : null;
      return {
        id: run.id,
        slug: run.slug,
        title: run.title,
        date: run.date.toISOString(),
        dayOfWeek: run.dayOfWeek,
        meetUpPoint: run.meetUpPoint,
        meetUpCity: run.meetUpCity,
        meetUpState: run.meetUpState,
        startTimeHour: run.startTimeHour,
        startTimeMinute: run.startTimeMinute,
        startTimePeriod: run.startTimePeriod,
        totalMiles: run.totalMiles,
        pace: run.pace,
        rsvpCount: goingRsvps.length,
        myRsvpStatus: myRsvp?.status ?? null,
      };
    });

    const recentFormatted = recentRuns.map((run) => {
      const photos = run.city_run_checkins
        .map((c) => c.runPhotoUrl)
        .filter((p): p is string => !!p);
      const shouts = run.city_run_checkins
        .map((c) => c.runShouts)
        .filter((s): s is string => !!s && s.trim().length > 0);
      return {
        id: run.id,
        slug: run.slug,
        title: run.title,
        date: run.date.toISOString(),
        dayOfWeek: run.dayOfWeek,
        meetUpPoint: run.meetUpPoint,
        checkinCount: run.city_run_checkins.length,
        photos,
        topShouts: shouts.slice(0, 3),
        attendees: run.city_run_checkins.map((c) => ({
          id: c.athleteId,
          firstName: c.Athlete?.firstName ?? null,
          lastName: c.Athlete?.lastName ?? null,
          photoURL: c.Athlete?.photoURL ?? null,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      club,
      upcomingRuns: upcomingFormatted,
      recentRuns: recentFormatted,
    });
  } catch (error: any) {
    console.error('[GET /api/runclub/[slug]] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load run club', details: error?.message },
      { status: 500 }
    );
  }
}
