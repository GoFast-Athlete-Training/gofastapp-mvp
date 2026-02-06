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
 * - runType: Filter by type (SINGLE_EVENT, RECURRING, INSTANCE, APPROVED)
 * - hasParent: Filter instances (true = has recurringParentId)
 */
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
    const runType = searchParams.get('runType');
    const hasParent = searchParams.get('hasParent');

    const where: any = {};
    
    if (runType) {
      where.runType = runType;
    }
    
    if (hasParent === 'true') {
      where.recurringParentId = { not: null };
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
      needsApproval: run.runType === 'INSTANCE',
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
