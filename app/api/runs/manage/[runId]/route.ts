export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

const RUNTIME_COMMIT_SHA =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.RENDER_GIT_COMMIT ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_SHA ||
  'unknown';

function getDbHost() {
  const databaseUrl = process.env.DATABASE_URL || '';
  try {
    return new URL(databaseUrl).hostname || 'unknown';
  } catch {
    return 'unparseable';
  }
}

function isMissingCityRunsColumn(error: any) {
  return (
    error?.code === 'P2022' &&
    typeof error?.message === 'string' &&
    error.message.includes('city_runs.')
  );
}

function isMissingRunClubsColumn(error: any) {
  return (
    error?.code === 'P2022' &&
    typeof error?.message === 'string' &&
    error.message.includes('run_clubs.')
  );
}

async function logCityRunsRuntimeDiagnostics(context: string) {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name='city_runs' AND column_name IN ('postRunActivity','stravaUrl','stravaText','webUrl','webText','igPostText','igPostGraphic','routeNeighborhood','runType','workoutDescription') ORDER BY column_name"
    )) as Array<{ column_name: string }>;
    console.error(`[${context}] Runtime diagnostics`, {
      commitSha: RUNTIME_COMMIT_SHA,
      dbHost: getDbHost(),
      cityRunsColumns: rows.map((r) => r.column_name),
    });
  } catch (diagnosticError: any) {
    console.error(`[${context}] Failed runtime diagnostics`, {
      commitSha: RUNTIME_COMMIT_SHA,
      dbHost: getDbHost(),
      diagnosticError: diagnosticError?.message,
    });
  }
}

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
    console.log('[GET /api/runs/manage/[runId]] Runtime info', {
      runId,
      commitSha: RUNTIME_COMMIT_SHA,
      dbHost: getDbHost(),
    });

    let run: any;
    try {
      run = await prisma.city_runs.findUnique({
        where: { id: runId },
        include: {
          runClub: {
            select: {
              id: true,
              slug: true,
              name: true,
              logoUrl: true,
              city: true,
              description: true,
              websiteUrl: true,
              instagramUrl: true,
              stravaUrl: true,
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
    } catch (error: any) {
      if (!isMissingRunClubsColumn(error)) throw error;
      console.warn('[GET /api/runs/manage/[runId]] run_clubs column missing; retrying without run club URL fields');
      run = await prisma.city_runs.findUnique({
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
    }

    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      run: {
        ...run,
        routePhotos: Array.isArray(run.routePhotos) ? run.routePhotos : null,
        rsvps: run.city_run_rsvps,
      },
    });
  } catch (error: any) {
    if (isMissingCityRunsColumn(error)) {
      await logCityRunsRuntimeDiagnostics('GET /api/runs/manage/[runId]');
    }
    console.error('Error fetching CityRun for management:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch CityRun', details: error?.message },
      { status: 500 }
    );
  }
}

const VALID_WORKFLOW_STATUSES = ['DEVELOP', 'PENDING', 'SUBMITTED', 'APPROVED'] as const;

/**
 * PATCH /api/runs/manage/[runId]
 * Update run workflow status (DEVELOP -> PENDING -> SUBMITTED -> APPROVED). Used by GoFastCompany workflow flow.
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
        { success: false, error: 'workflowStatus required: DEVELOP, PENDING, SUBMITTED, or APPROVED' },
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

    const updateData: { workflowStatus: 'DEVELOP' | 'PENDING' | 'SUBMITTED' | 'APPROVED'; updatedAt: Date; staffNotes?: string | null } = {
      workflowStatus: workflowStatus as 'DEVELOP' | 'PENDING' | 'SUBMITTED' | 'APPROVED',
      updatedAt: new Date(),
    };
    if (staffNotes !== undefined) {
      updateData.staffNotes = staffNotes === null || staffNotes === '' ? null : String(staffNotes).trim();
    }

    let updated: any;
    try {
      updated = await prisma.city_runs.update({
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
              description: true,
              websiteUrl: true,
              instagramUrl: true,
              stravaUrl: true,
            },
          },
        },
      });
    } catch (error: any) {
      if (!isMissingRunClubsColumn(error)) throw error;
      console.warn('[PATCH /api/runs/manage/[runId]] run_clubs column missing; retrying without run club URL fields');
      updated = await prisma.city_runs.update({
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
    }

    return NextResponse.json({
      success: true,
      run: updated,
      message:
        workflowStatus === 'SUBMITTED'
          ? 'Run submitted for approval'
          : workflowStatus === 'APPROVED'
            ? 'Run approved'
            : workflowStatus === 'PENDING'
              ? 'Run moved to pending'
              : workflowStatus === 'DEVELOP'
                ? 'Run restaged to develop'
                : 'Run status updated',
    });
  } catch (error: any) {
    console.error('Error updating run workflow status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update run', details: error?.message },
      { status: 500 }
    );
  }
}
