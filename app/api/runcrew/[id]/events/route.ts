export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { hydrateCrew, createEvent } from '@/lib/domain-runcrew';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing crew id' }, { status: 400 });
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

    let crew;
    try {
      crew = await hydrateCrew(id, athlete.id);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    // Verify user is a member of the crew (using box structure)
    const isMember = crew.membershipsBox?.memberships?.some(
      (m: any) => m.athleteId === athlete.id
    );
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch events for the crew
    const events = await prisma.runCrewEvent.findMany({
      where: { runCrewId: id },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoURL: true,
          },
        },
        rsvps: {
          include: {
            athlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photoURL: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return NextResponse.json({ success: true, events });
  } catch (err) {
    console.error('Events GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

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

    let crew;
    try {
      crew = await hydrateCrew(id, athlete.id);
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

