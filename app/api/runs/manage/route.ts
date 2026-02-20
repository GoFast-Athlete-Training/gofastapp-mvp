export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * GET /api/runs/manage
 * 
 * List all CityRuns for management (templates + instances)
 * CityRun is a universal run system - this endpoint returns all CityRuns
 * Supports filtering by runType
 * 
 * Query params:
 * - workflowStatus: DRAFT | SUBMITTED | APPROVED
 * - pastOnly: "true" = only runs with startDate before today (for adding photos, etc.)
 * - upcomingOnly: default "true"; "false" = return all runs (no date filter)
 */
function getStartOfTodayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET(request: Request) {
  try {
    // Verify authentication
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

    const { searchParams } = new URL(request.url);
    const workflowStatus = searchParams.get('workflowStatus');
    const pastOnly = searchParams.get('pastOnly') === 'true';
    const upcomingOnly = searchParams.get('upcomingOnly') !== 'false';

    const where: any = {};
    if (workflowStatus && ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(workflowStatus)) {
      where.workflowStatus = workflowStatus;
    }
    const startOfToday = getStartOfTodayUTC();
    if (pastOnly) {
      where.startDate = { lt: startOfToday };
    } else if (upcomingOnly) {
      where.startDate = { gte: startOfToday };
    }

    const runs = await prisma.city_runs.findMany({
      where,
      include: {
        runClub: {
          select: {
            id: true,
            slug: true,
            name: true,
            logoUrl: true,
            city: true,
          },
        },
        _count: {
          select: {
            city_run_rsvps: {
              where: {
                status: 'going' // Count only "going" RSVPs
              }
            }
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' }
      ],
    });

    // Transform to include rsvpCount
    const runsWithCounts = runs.map(run => ({
      ...run,
      rsvpCount: run._count.city_run_rsvps,
    }));

    return NextResponse.json({
      success: true,
      runs: runsWithCounts,
    });
  } catch (error: any) {
    console.error('Error fetching CityRuns for management:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch CityRuns', details: error?.message },
      { status: 500 }
    );
  }
}
