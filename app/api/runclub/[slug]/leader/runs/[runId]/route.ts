export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { leaderAuthFailureResponse, requireRunClubLeader } from '@/lib/run-club-leader-auth';
import {
  LEADER_ALLOWED_WORKFLOW_STATUSES,
  LEADER_CITY_RUN_UPDATABLE_FIELDS,
  pickLeaderFields,
} from '@/lib/run-club-leader-scope';
import { parseRunTotalMiles } from '@/lib/parse-run-total-miles';
import { toCanonicalDayOfWeek } from '@/lib/utils/dayOfWeekConverter';
import { parseCalendarDateForWrite } from '@/lib/calendar-date';

/**
 * PATCH /api/runclub/[slug]/leader/runs/[runId]
 * Update a city run the leader owns (club-scoped). Leaders may submit for review but not approve.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; runId: string }> }
) {
  try {
    const { slug, runId } = await params;
    const auth = await requireRunClubLeader(request, { slug });
    if ('error' in auth) {
      return leaderAuthFailureResponse(auth);
    }

    const run = await prisma.city_runs.findUnique({
      where: { id: runId },
      select: { id: true, runClubId: true, workflowStatus: true },
    });

    if (!run || run.runClubId !== auth.club.id) {
      return NextResponse.json({ success: false, error: 'Run not found' }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch = pickLeaderFields(body, LEADER_CITY_RUN_UPDATABLE_FIELDS);
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (patch.title !== undefined && String(patch.title).trim()) {
      updateData.title = String(patch.title).trim();
    }
    if (patch.date !== undefined && patch.date) {
      updateData.date = parseCalendarDateForWrite(String(patch.date));
    }
    if (patch.dayOfWeek !== undefined) {
      const canonical =
        patch.dayOfWeek == null || patch.dayOfWeek === ''
          ? null
          : toCanonicalDayOfWeek(String(patch.dayOfWeek));
      updateData.dayOfWeek = canonical ?? String(patch.dayOfWeek);
    }
    if (patch.totalMiles !== undefined) {
      updateData.totalMiles = parseRunTotalMiles(patch.totalMiles);
    }
    if (patch.pace !== undefined) {
      updateData.pace =
        patch.pace == null || patch.pace === '' ? null : String(patch.pace);
    }
    if (patch.description !== undefined) {
      updateData.description =
        patch.description == null || patch.description === ''
          ? null
          : String(patch.description);
    }
    if (patch.postRunActivity !== undefined) {
      updateData.postRunActivity =
        patch.postRunActivity == null || patch.postRunActivity === ''
          ? null
          : String(patch.postRunActivity).trim();
    }
    if (patch.meetUpPoint !== undefined && String(patch.meetUpPoint).trim()) {
      updateData.meetUpPoint = String(patch.meetUpPoint).trim();
    }

    const stringFields = [
      'meetUpStreetAddress',
      'meetUpCity',
      'meetUpState',
      'meetUpZip',
      'meetUpPlaceId',
      'endPoint',
      'endStreetAddress',
      'endCity',
      'endState',
      'routeNeighborhood',
      'runType',
      'workoutDescription',
      'directionsText',
      'timezone',
      'startTimePeriod',
      'stravaMapUrl',
      'mapImageUrl',
    ] as const;

    for (const key of stringFields) {
      if (patch[key] !== undefined) {
        updateData[key] =
          patch[key] == null || patch[key] === '' ? null : String(patch[key]);
      }
    }

    if (patch.startTimeHour !== undefined) {
      updateData.startTimeHour =
        patch.startTimeHour == null || patch.startTimeHour === ''
          ? null
          : parseInt(String(patch.startTimeHour), 10);
    }
    if (patch.startTimeMinute !== undefined) {
      updateData.startTimeMinute =
        patch.startTimeMinute == null || patch.startTimeMinute === ''
          ? null
          : parseInt(String(patch.startTimeMinute), 10);
    }
    if (patch.meetUpLat !== undefined) {
      updateData.meetUpLat =
        patch.meetUpLat == null || patch.meetUpLat === ''
          ? null
          : parseFloat(String(patch.meetUpLat));
    }
    if (patch.meetUpLng !== undefined) {
      updateData.meetUpLng =
        patch.meetUpLng == null || patch.meetUpLng === ''
          ? null
          : parseFloat(String(patch.meetUpLng));
    }
    if (patch.routePhotos !== undefined) {
      updateData.routePhotos = Array.isArray(patch.routePhotos)
        ? patch.routePhotos.filter((u): u is string => typeof u === 'string')
        : null;
    }

    if (body.workflowStatus !== undefined) {
      const next = String(body.workflowStatus).toUpperCase();
      if (!LEADER_ALLOWED_WORKFLOW_STATUSES.includes(next as (typeof LEADER_ALLOWED_WORKFLOW_STATUSES)[number])) {
        return NextResponse.json(
          { success: false, error: 'Leaders may only set workflowStatus to DEVELOP, PENDING, or SUBMITTED' },
          { status: 403 }
        );
      }
      updateData.workflowStatus = next;
    }

    if (Object.keys(updateData).length <= 1) {
      return NextResponse.json({ success: false, error: 'No allowed fields to update' }, { status: 400 });
    }

    const updated = await prisma.city_runs.update({
      where: { id: runId },
      data: updateData as Parameters<typeof prisma.city_runs.update>[0]['data'],
    });

    return NextResponse.json({
      success: true,
      run: {
        ...updated,
        date: updated.date.toISOString(),
      },
      message:
        updateData.workflowStatus === 'SUBMITTED'
          ? 'Run submitted for staff review'
          : 'Run updated',
    });
  } catch (error: unknown) {
    console.error('[PATCH leader run] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update run' },
      { status: 500 }
    );
  }
}
