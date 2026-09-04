export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { prisma } from '@/lib/prisma';
import { resolveCityRunIdBySegment } from '@/lib/city-run-resolve-segment';
import { evaluateAthleteCtaTriggers } from '@/lib/cta-triggers';
import {
  declinePlannedWorkoutIRan,
  rsvpRoleToIRanRole,
  stampPlannedWorkoutIRan,
} from '@/lib/planned-workouts/i-ran';
import { RSVP_ROLE_HOST } from '@/lib/city-run/rsvp-role';

function generateId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

/**
 * GET /api/runs/[runId]/checkin
 * Returns all check-ins for a run + the caller's own check-in.
 * Auth required.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const segment = ((await params).runId || '').trim();
    if (!segment) return NextResponse.json({ error: 'Missing run id' }, { status: 400 });
    const resolvedId = await resolveCityRunIdBySegment(segment);
    if (!resolvedId) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const [checkins, iRanStamp] = await Promise.all([
      prisma.city_run_checkins.findMany({
        where: { runId: resolvedId },
        include: {
          Athlete: { select: { id: true, firstName: true, lastName: true, photoURL: true } },
        },
        orderBy: { checkedInAt: 'asc' },
      }),
      prisma.planned_workouts.findFirst({
        where: { athleteId: athlete.id, cityRunId: resolvedId },
        select: { iRanAt: true, iRanRole: true, iRanDeclined: true },
      }),
    ]);

    const myCheckin = checkins.find(c => c.athleteId === athlete.id) ?? null;

    return NextResponse.json({
      success: true,
      checkins,
      myCheckin,
      iRan: iRanStamp
        ? {
            iRanAt: iRanStamp.iRanAt?.toISOString() ?? null,
            iRanRole: iRanStamp.iRanRole,
            iRanDeclined: iRanStamp.iRanDeclined,
          }
        : null,
    });
  } catch (err) {
    console.error('GET /checkin error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type CheckinBody = {
  /** yes = I ran; no = I did not; omit for legacy club check-in upsert */
  attended?: boolean;
  runPhotoUrl?: string;
  runShouts?: string;
};

/**
 * POST /api/runs/[runId]/checkin
 * Creates or updates the caller's check-in / I-ran stamp for a run.
 * Body: { attended?: boolean, runPhotoUrl?: string, runShouts?: string }
 *
 * attended true → stamp planned_workouts.iRanAt + legacy checkin row
 * attended false → planned_workouts.iRanDeclined (no checkin row)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const segment = ((await params).runId || '').trim();
    if (!segment) return NextResponse.json({ error: 'Missing run id' }, { status: 400 });
    const resolvedId = await resolveCityRunIdBySegment(segment);
    if (!resolvedId) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const run = await prisma.city_runs.findUnique({ where: { id: resolvedId } });
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as CheckinBody;
    const { runPhotoUrl, runShouts, attended } = body;

    if (attended === false) {
      const declined = await declinePlannedWorkoutIRan({
        athleteId: athlete.id,
        cityRunId: resolvedId,
      });
      if (!declined.ok) {
        return NextResponse.json(
          { error: 'No planned stamp for this run — RSVP first.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, declined: true });
    }

    const rsvp = await prisma.city_run_rsvps.findUnique({
      where: { runId_athleteId: { runId: resolvedId, athleteId: athlete.id } },
      select: { role: true },
    });
    const iRanRole = rsvpRoleToIRanRole(rsvp?.role);

    const now = new Date();
    await stampPlannedWorkoutIRan({
      athleteId: athlete.id,
      cityRunId: resolvedId,
      role: iRanRole,
      at: now,
    });

    const checkin = await prisma.city_run_checkins.upsert({
      where: { runId_athleteId: { runId: resolvedId, athleteId: athlete.id } },
      update: {
        runPhotoUrl: runPhotoUrl ?? undefined,
        runShouts: runShouts ?? undefined,
        checkedInAt: now,
        updatedAt: now,
      },
      create: {
        id: generateId(),
        runId: resolvedId,
        athleteId: athlete.id,
        runPhotoUrl: runPhotoUrl ?? null,
        runShouts: runShouts ?? null,
        checkedInAt: now,
        updatedAt: now,
      },
      include: {
        Athlete: { select: { id: true, firstName: true, lastName: true, photoURL: true } },
      },
    });

    if (rsvp) {
      await prisma.city_run_rsvps.update({
        where: { runId_athleteId: { runId: resolvedId, athleteId: athlete.id } },
        data: { checkedInAt: now },
      });
    }

    void evaluateAthleteCtaTriggers({
      athleteId: athlete.id,
      source: 'city-run-checkin',
    }).catch((err) => {
      console.warn('evaluateAthleteCtaTriggers after checkin:', err);
    });

    return NextResponse.json({
      success: true,
      checkin,
      iRan: { iRanAt: now.toISOString(), iRanRole },
    });
  } catch (err) {
    console.error('POST /checkin error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
