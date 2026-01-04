export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { hydrateCrew, rsvpToRun } from '@/lib/domain-runcrew';

// POST /api/runcrew/[id]/runs/[runId]/rsvp - RSVP to a run
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const { id, runId } = await params;
    if (!id || !runId) {
      return NextResponse.json({ error: 'Missing crew id or run id' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const { status } = body;
    if (!status || !['going', 'maybe', 'not-going'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be going, maybe, or not-going' }, { status: 400 });
    }

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

    const firebaseId = decodedToken.uid;

    let athlete;
    try {
      athlete = await getAthleteByFirebaseId(firebaseId);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Verify user is a member of the crew
    let crew;
    try {
      crew = await hydrateCrew(id);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    const membership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.athleteId === athlete.id
    );
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden - Must be a member' }, { status: 403 });
    }

    // Verify run exists and belongs to this crew
    const run = crew.runsBox?.runs?.find((r: any) => r.id === runId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Create or update RSVP
    let rsvp;
    try {
      rsvp = await rsvpToRun({
        runId,
        athleteId: athlete.id,
        status: status as 'going' | 'maybe' | 'not-going',
      });
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, rsvp });
  } catch (err) {
    console.error('Error RSVPing to run:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

