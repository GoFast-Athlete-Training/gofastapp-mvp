export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * POST /api/runs/manage/[runId]/approve
 * Set workflowStatus to APPROVED (submit-for-approval flow). MVP1: all runs are SINGLE_EVENT.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { runId } = await params;

    const run = await prisma.city_runs.findUnique({
      where: { id: runId },
      select: { id: true, title: true },
    });

    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    const updatedRun = await prisma.city_runs.update({
      where: { id: runId },
      data: {
        workflowStatus: 'APPROVED',
        updatedAt: new Date(),
      },
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
      },
    });

    return NextResponse.json({
      success: true,
      run: updatedRun,
      message: 'CityRun approved successfully',
    });
  } catch (error: any) {
    console.error('Error approving CityRun:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve CityRun', details: error?.message },
      { status: 500 }
    );
  }
}
