export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

const VALID_WORKFLOW_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED'] as const;

/**
 * POST /api/runs/manage/bulk-workflow-status
 *
 * Bulk update workflow status for multiple runs (e.g. "send back to queue" = DRAFT).
 * Body: { runIds: string[], workflowStatus: "DRAFT" | "SUBMITTED" | "APPROVED" }
 */
export async function POST(request: Request) {
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
        { success: false, error: 'workflowStatus required: DRAFT, SUBMITTED, or APPROVED' },
        { status: 400 }
      );
    }

    const result = await prisma.city_runs.updateMany({
      where: { id: { in: runIds } },
      data: {
        workflowStatus: workflowStatus as (typeof VALID_WORKFLOW_STATUSES)[number],
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
      workflowStatus,
      message:
        workflowStatus === 'DRAFT'
          ? `${result.count} run(s) sent back to queue`
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
