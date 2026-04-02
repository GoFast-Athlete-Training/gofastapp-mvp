export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { hydrateCrew, createEvent } from '@/lib/domain-runcrew';

// GET removed - use GET /api/runcrew/[id] for hydration (returns all boxes)
// Note: events are currently excluded from hydrate, but this route kept for POST mutations

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing crew id' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

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

    // Check role from membership (using box structure)
    const membership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.athleteId === athlete.id
    );
    if (!membership || (membership.role !== 'admin' && membership.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { title, date, time, location, address, description, eventType } = body;

    if (!title || !date || !time || !location) {
      return NextResponse.json(
        { error: 'Title, date, time, and location are required' },
        { status: 400 }
      );
    }

    let event;
    try {
      event = await createEvent({
        runCrewId: id,
        organizerId: athlete.id,
        title,
        date: new Date(date),
        time,
        location,
        address,
        description,
        eventType,
      });
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, event });
  } catch (err) {
    console.error('Events POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

