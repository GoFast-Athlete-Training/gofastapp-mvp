export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertRunManageAuth } from '@/lib/runmanage/require-run-manage-auth';
import {
  bulkDataWhenSettingWorkflowStatus,
  type RunWorkflowStatus,
} from '@/lib/runInstanceApprovalPublish';

const VALID_WORKFLOW_STATUSES = ['DEVELOP', 'PENDING', 'SUBMITTED', 'APPROVED'] as const;

/**
 * POST /api/runs/manage/bulk-workflow-status
 *
 * Bulk update workflow status for multiple runs.
 * Body: { runIds: string[], workflowStatus: "DEVELOP" | "PENDING" | "SUBMITTED" | "APPROVED" }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await assertRunManageAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { runIds, workflowStatus } = body;

    if (!Array.isArray(runIds) || runIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'runIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!workflowStatus || !VALID_WORKFLOW_STATUSES.includes(workflowStatus)) {
      return NextResponse.json(
        { success: false, error: 'workflowStatus required: DEVELOP, PENDING, SUBMITTED, or APPROVED' },
        { status: 400 }
      );
    }

    const status = workflowStatus as RunWorkflowStatus;

    const result = await prisma.city_runs.updateMany({
      where: { id: { in: runIds } },
      data: bulkDataWhenSettingWorkflowStatus(status),
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
      workflowStatus,
      message:
        workflowStatus === 'PENDING'
          ? `${result.count} run(s) sent for rework (Pending)`
          : workflowStatus === 'DEVELOP'
            ? `${result.count} run(s) restaged to Develop`
            : `Updated ${result.count} run(s) to ${workflowStatus}`,
    });
  } catch (error: any) {
    console.error('Error bulk updating run workflow status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to bulk update run status',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
