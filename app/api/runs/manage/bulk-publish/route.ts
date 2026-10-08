export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertRunManageAuth } from '@/lib/runmanage/require-run-manage-auth';
import { bulkDataWhenPublishing } from '@/lib/runInstanceApprovalPublish';
import { assertClubRunVerifiedForPublish } from '@/lib/club-run-club-review';

/**
 * POST /api/runs/manage/bulk-publish
 *
 * Publish run instances live (sets published: true and workflowStatus: APPROVED).
 * Body: { runIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await assertRunManageAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const runIds = Array.isArray(body.runIds) ? body.runIds.map(String) : [];

    if (runIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'runIds must be a non-empty array' },
        { status: 400 }
      );
    }

    const targets = await prisma.city_runs.findMany({
      where: { id: { in: runIds } },
      select: { id: true, cityRunType: true, clubReviewStatus: true },
    });

    const blocked = targets.filter((run) => !assertClubRunVerifiedForPublish(run).ok);
    if (blocked.length > 0) {
      const gate = assertClubRunVerifiedForPublish(blocked[0]);
      return NextResponse.json(
        {
          success: false,
          error: gate.ok ? 'Publish blocked' : gate.error,
          blockedRunIds: blocked.map((r) => r.id),
        },
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
