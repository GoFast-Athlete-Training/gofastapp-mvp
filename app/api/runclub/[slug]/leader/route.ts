export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { leaderAuthFailureResponse, requireRunClubLeader } from '@/lib/run-club-leader-auth';
import { getLeaderDashboard } from '@/lib/domain-runclub-leader';

/**
 * GET /api/runclub/[slug]/leader
 * Leader dashboard: club summary, series, upcoming runs, announcements, events.
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

    const dashboard = await getLeaderDashboard(auth.club.id, auth.membership.role);
    if (!dashboard.club) {
      return NextResponse.json({ success: false, error: 'Run club not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      membership: auth.membership,
      ...dashboard,
    });
  } catch (error: unknown) {
    console.error('[GET /api/runclub/[slug]/leader] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load leader dashboard',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
