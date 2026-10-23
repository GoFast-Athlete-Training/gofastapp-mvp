export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertRunManageAuth } from '@/lib/runmanage/require-run-manage-auth';

/**
 * POST /api/runs/manage/bulk-delete
 *
 * Delete multiple runs by ID. Cascade removes RSVPs.
 * Body: { runIds: string[], raceRegistryId?: string, scope?: "race_shakeout" }
 *
 * When scope is race_shakeout, raceRegistryId is required and only matching hub shakeouts are deleted.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await assertRunManageAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const runIds = body.runIds;
    const raceRegistryId =
      typeof body.raceRegistryId === 'string' ? body.raceRegistryId.trim() : '';
    const scope = body.scope === 'race_shakeout' ? 'race_shakeout' : null;

    if (!Array.isArray(runIds) || runIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'runIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (scope === 'race_shakeout' && !raceRegistryId) {
      return NextResponse.json(
        { success: false, error: 'raceRegistryId required for race_shakeout bulk delete' },
        { status: 400 }
      );
    }

    const where =
      scope === 'race_shakeout'
        ? {
            id: { in: runIds as string[] },
            raceRegistryId,
            cityRunType: 'RACE_SHAKEOUT' as const,
          }
        : { id: { in: runIds as string[] } };

    const result = await prisma.city_runs.deleteMany({
      where,
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Deleted ${result.count} run(s).`,
    });
  } catch (error: any) {
    console.error('Error bulk deleting runs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to bulk delete runs',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
