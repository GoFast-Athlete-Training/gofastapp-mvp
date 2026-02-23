export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * PATCH /api/run-series/[id]/workflow-status
 * Set workflowStatus (e.g. PENDING = assign to VA cue). Body: { workflowStatus: "PENDING" | "STUBBED" }.
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

    if (!workflowStatus || !['STUBBED', 'PENDING'].includes(workflowStatus)) {
      return NextResponse.json(
        { success: false, error: 'workflowStatus must be STUBBED or PENDING' },
        { status: 400 }
      );
    }

    const existing = await prisma.run_series.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Run series not found' }, { status: 404 });
    }

    const series = await prisma.run_series.update({
      where: { id },
      data: { workflowStatus: workflowStatus as 'STUBBED' | 'PENDING', updatedAt: new Date() },
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
