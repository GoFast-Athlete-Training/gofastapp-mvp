export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';
import {
  bulkDataWhenPublishing,
  bulkDataWhenSettingWorkflowStatus,
} from '@/lib/runInstanceApprovalPublish';

/**
 * POST /api/runs/manage/bulk-publish
 *
 * Publish run instances live (sets published: true and workflowStatus: APPROVED).
 * Body: { runIds: string[] }
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
    const runIds = Array.isArray(body.runIds) ? body.runIds.map(String) : [];

    if (runIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'runIds must be a non-empty array' },
        { status: 400 }
      );
    }

    const result = await prisma.city_runs.updateMany({
      where: {
        id: { in: runIds },
        OR: [{ published: false }, { workflowStatus: { not: 'APPROVED' } }],
      },
      data: bulkDataWhenPublishing(),
    });

    return NextResponse.json({
      success: true,
      published: result.count,
      message: `Published ${result.count} run instance(s)`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error bulk publishing runs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to bulk publish runs',
        details: message,
      },
      { status: 500 }
    );
  }
}
