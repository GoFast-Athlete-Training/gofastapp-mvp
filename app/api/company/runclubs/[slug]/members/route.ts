export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getClubMembersWithEngagement } from '@/lib/engagement';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/company/runclubs/[slug]/members
 *
 * HQ club roster with per-member engagement counts for sponsor/audience views.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Missing club slug' },
        { status: 400, headers: corsHeaders }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401, headers: corsHeaders }
      );
    }

    const club = await prisma.run_clubs.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });

    if (!club) {
      return NextResponse.json(
        { success: false, error: 'Run club not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const { members, totals } = await getClubMembersWithEngagement(club.id);

    const formattedMembers = members.map((m) => {
      const rsvpLifetime = m.engagement.runsRsvpdGoing.lifetime;
      const attendedLifetime = m.engagement.runsAttended.lifetime;
      return {
        athleteId: m.athleteId,
        name: m.name,
        city: m.city,
        state: m.state,
        gender: m.gender,
        age: m.age,
        joinedAt: m.joinedAt,
        lastSeenAt: m.engagement.lastSeenAt,
        avgWeeklyMilesSnapshot: m.engagement.avgWeeklyMilesSnapshot,
        runsAttended: attendedLifetime,
        runsAttendedLast30d: m.engagement.runsAttended.last30d,
        lastRunAttendedAt: m.engagement.runsAttended.lastAttendedAt,
        runsRsvpdGoing: rsvpLifetime,
        rsvpToCheckinRate:
          rsvpLifetime > 0 ? attendedLifetime / rsvpLifetime : null,
        activityCountLast30d: m.engagement.activityCountLast30d,
        raceSignups: m.engagement.raceSignups,
        raceResults: m.engagement.raceResults,
      };
    });

    const avgConversionRates = formattedMembers
      .map((m) => m.rsvpToCheckinRate)
      .filter((r): r is number => r != null);
    const avgConversionRate =
      avgConversionRates.length > 0
        ? avgConversionRates.reduce((sum, r) => sum + r, 0) / avgConversionRates.length
        : null;

    return NextResponse.json(
      {
        success: true,
        club,
        totals: {
          ...totals,
          avgConversionRate,
        },
        members: formattedMembers,
      },
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('[GET /api/company/runclubs/[slug]/members] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error', details: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
