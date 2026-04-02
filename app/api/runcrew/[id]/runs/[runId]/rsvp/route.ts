export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
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
    if (!status || !['going', 'not-going'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be going or not-going' }, { status: 400 });
    }

    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

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
        status: status as 'going' | 'not-going',
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

