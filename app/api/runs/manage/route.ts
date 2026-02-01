export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/runs/manage
 * 
 * List all runs for management (templates + instances)
 * Supports filtering by runType
 * 
 * Query params:
 * - runType: Filter by type (SINGLE_EVENT, RECURRING, INSTANCE, APPROVED)
 * - hasParent: Filter instances (true = has recurringParentId)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
            run_crew_run_rsvps: {
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
      rsvpCount: run._count.run_crew_run_rsvps,
      needsApproval: run.runType === 'INSTANCE',
    }));

    return NextResponse.json({
      success: true,
      runs: runsWithCounts,
    });
  } catch (error: any) {
    console.error('Error fetching runs for management:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch runs', details: error?.message },
      { status: 500 }
    );
  }
}
