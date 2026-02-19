export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * GET /api/runs/manage/[runId]
 * 
 * Get CityRun details with RSVPs for management
 * CityRun is a universal run system - returns full details including all RSVPs
 */
export async function GET(
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

    const run = await prisma.city_runs.findUnique({
      where: { id: runId },
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
        city_run_rsvps: {
          include: {
            Athlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      run: {
        ...run,
        rsvps: run.city_run_rsvps,
      },
    });
  } catch (error: any) {
    console.error('Error fetching CityRun for management:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch CityRun', details: error?.message },
      { status: 500 }
    );
  }
}

const VALID_WORKFLOW_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED'] as const;

/**
 * PATCH /api/runs/manage/[runId]
 * Update run workflow status (DRAFT -> SUBMITTED -> APPROVED). Used by GoFastCompany for submit/approve flow.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
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

    const { runId } = await params;
    const body = await request.json();
    const { workflowStatus, staffNotes } = body;

    if (!workflowStatus || !VALID_WORKFLOW_STATUSES.includes(workflowStatus)) {
      return NextResponse.json(
        { success: false, error: 'workflowStatus required: DRAFT, SUBMITTED, or APPROVED' },
        { status: 400 }
      );
    }

    const run = await prisma.city_runs.findUnique({
      where: { id: runId },
      select: { id: true, workflowStatus: true },
    });

    if (!run) {
      return NextResponse.json({ success: false, error: 'CityRun not found' }, { status: 404 });
    }

    const updateData: { workflowStatus: 'DRAFT' | 'SUBMITTED' | 'APPROVED'; updatedAt: Date; staffNotes?: string | null } = {
      workflowStatus: workflowStatus as 'DRAFT' | 'SUBMITTED' | 'APPROVED',
      updatedAt: new Date(),
    };
    if (staffNotes !== undefined) {
      updateData.staffNotes = staffNotes === null || staffNotes === '' ? null : String(staffNotes).trim();
    }

    const updated = await prisma.city_runs.update({
      where: { id: runId },
      data: updateData,
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
      run: updated,
      message: workflowStatus === 'SUBMITTED' ? 'Run submitted for approval' : workflowStatus === 'APPROVED' ? 'Run approved' : 'Run status updated',
    });
  } catch (error: any) {
    console.error('Error updating run workflow status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update run', details: error?.message },
      { status: 500 }
    );
  }
}
