export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/runs/manage/[runId]/approve
 * 
 * Approve an INSTANCE run - changes runType to APPROVED
 * Only works on INSTANCE type runs
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { runId } = await params;

    // Check run exists and is INSTANCE type
    const run = await prisma.city_runs.findUnique({
      where: { id: runId },
      select: { id: true, runType: true, title: true },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    if (run.runType !== 'INSTANCE') {
      return NextResponse.json(
        { error: `Cannot approve run of type ${run.runType}. Only INSTANCE runs can be approved.` },
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
      message: 'Run approved successfully',
    });
  } catch (error: any) {
    console.error('Error approving run:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve run', details: error?.message },
      { status: 500 }
    );
  }
}
