export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * GET /api/runs/manage/[runId]
 * 
 * Get run details with RSVPs for management
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
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

    const { runId } = await params;

    const run = await prisma.city_runs.findUnique({
      where: { id: runId },
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
        recurringParent: {
          select: {
            id: true,
            title: true,
            runType: true,
          },
        },
        run_crew_run_rsvps: {
          include: {
            Athlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      run: {
        ...run,
        rsvps: run.run_crew_run_rsvps,
      },
    });
  } catch (error: any) {
    console.error('Error fetching run for management:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch run', details: error?.message },
      { status: 500 }
    );
  }
}
