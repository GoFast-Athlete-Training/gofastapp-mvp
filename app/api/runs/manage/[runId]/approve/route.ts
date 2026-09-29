export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertStaffBearerAuth } from '@/lib/training/training-engine-auth';
import { fieldsWhenSettingWorkflowStatus } from '@/lib/runInstanceApprovalPublish';

/**
 * POST /api/runs/manage/[runId]/approve
 * Set workflowStatus to APPROVED (submit-for-approval flow). City runs are single-occurrence rows.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const authErr = await assertStaffBearerAuth(request);
    if (authErr) return authErr;

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
        ...fieldsWhenSettingWorkflowStatus('APPROVED'),
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
