export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * POST /api/runs/manage/[runId]/approve
 * 
 * Approve an INSTANCE CityRun - changes runType to APPROVED
 * Only works on INSTANCE type CityRuns
 * CityRun is a universal run system - this approves recurring run instances
 */
export async function POST(
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

    // Check run exists and is INSTANCE type
    const run = await prisma.city_runs.findUnique({
      where: { id: runId },
      select: { id: true, runType: true, title: true },
    });

    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    if (run.runType !== 'INSTANCE') {
      return NextResponse.json(
        { error: `Cannot approve CityRun of type ${run.runType}. Only INSTANCE CityRuns can be approved.` },
        { status: 400 }
      );
    }

    // Update runType to APPROVED
    const updatedRun = await prisma.city_runs.update({
      where: { id: runId },
      data: {
        runType: 'APPROVED',
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
