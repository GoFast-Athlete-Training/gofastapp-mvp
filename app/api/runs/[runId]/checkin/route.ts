export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { prisma } from '@/lib/prisma';

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
    const { runId } = await params;
    if (!runId) return NextResponse.json({ error: 'Missing run id' }, { status: 400 });

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

    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });

    const checkins = await prisma.city_run_checkins.findMany({
      where: { runId },
      include: {
        Athlete: { select: { id: true, firstName: true, lastName: true, photoURL: true } },
      },
      orderBy: { checkedInAt: 'asc' },
    });

    const myCheckin = checkins.find(c => c.athleteId === athlete.id) ?? null;

    return NextResponse.json({ success: true, checkins, myCheckin });
  } catch (err) {
    console.error('GET /checkin error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/runs/[runId]/checkin
 * Creates or updates the caller's check-in for a run.
 * Body: { runPhotoUrl?: string, runShouts?: string }
 *
 * No hard gate on RSVP — if you show up, you show up.
 * The check-in record itself becomes the membership for CityRunPostRunContainer.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    if (!runId) return NextResponse.json({ error: 'Missing run id' }, { status: 400 });

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

    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });

    const run = await prisma.city_runs.findUnique({ where: { id: runId } });
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const { runPhotoUrl, runShouts } = body;

    const checkin = await prisma.city_run_checkins.upsert({
      where: { runId_athleteId: { runId, athleteId: athlete.id } },
      update: {
        runPhotoUrl: runPhotoUrl ?? undefined,
        runShouts: runShouts ?? undefined,
        updatedAt: new Date(),
      },
      create: {
        id: generateId(),
        runId,
        athleteId: athlete.id,
        runPhotoUrl: runPhotoUrl ?? null,
        runShouts: runShouts ?? null,
        updatedAt: new Date(),
      },
      include: {
        Athlete: { select: { id: true, firstName: true, lastName: true, photoURL: true } },
      },
    });

    return NextResponse.json({ success: true, checkin });
  } catch (err) {
    console.error('POST /checkin error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
