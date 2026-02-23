export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * PATCH /api/run-series/[id]/workflow-status
 * Set workflowStatus. Same 4-stage enum as city_runs: DEVELOP | PENDING | SUBMITTED | APPROVED.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const body = await request.json();
    const workflowStatus = body.workflowStatus;

    const validStatuses = ['DEVELOP', 'PENDING', 'SUBMITTED', 'APPROVED'];
    if (!workflowStatus || !validStatuses.includes(workflowStatus)) {
      return NextResponse.json(
        { success: false, error: 'workflowStatus must be one of: DEVELOP, PENDING, SUBMITTED, APPROVED' },
        { status: 400 }
      );
    }

    const existing = await prisma.run_series.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Run series not found' }, { status: 404 });
    }

    const series = await prisma.run_series.update({
      where: { id },
      data: { workflowStatus: workflowStatus as 'DEVELOP' | 'PENDING' | 'SUBMITTED' | 'APPROVED', updatedAt: new Date() },
      include: {
        runClub: {
          select: {
            id: true,
            slug: true,
            name: true,
            city: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      series: {
        id: series.id,
        slug: series.slug,
        name: series.name,
        dayOfWeek: series.dayOfWeek,
        workflowStatus: series.workflowStatus,
        runClub: series.runClub,
      },
    });
  } catch (error: any) {
    console.error('[PATCH /api/run-series/[id]/workflow-status] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update workflow status', details: error?.message },
      { status: 500 }
    );
  }
}
