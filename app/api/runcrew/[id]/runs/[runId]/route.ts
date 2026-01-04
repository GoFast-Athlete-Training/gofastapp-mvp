export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { hydrateCrew } from '@/lib/domain-runcrew';

// PUT /api/runcrew/[id]/runs/[runId] - Update a run
export async function PUT(
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

    // Verify user is a member and has permission
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
    if (!membership || (membership.role !== 'admin' && membership.role !== 'manager')) {
      return NextResponse.json({ error: 'Forbidden - Admin or manager only' }, { status: 403 });
    }

    // Verify run exists and belongs to this crew
    const run = crew.runsBox?.runs?.find((r: any) => r.id === runId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Build update data
    const { prisma } = await import('@/lib/prisma');
    const updateData: any = {};

    if (body.title !== undefined) {
      updateData.title = body.title.trim();
    }
    if (body.date !== undefined) {
      updateData.date = new Date(body.date);
    }
    if (body.startTime !== undefined) {
      updateData.startTime = body.startTime.trim();
    }
    if (body.meetUpPoint !== undefined) {
      updateData.meetUpPoint = body.meetUpPoint.trim();
    }
    if (body.meetUpAddress !== undefined) {
      updateData.meetUpAddress = body.meetUpAddress?.trim() || null;
    }
    if (body.totalMiles !== undefined) {
      updateData.totalMiles = body.totalMiles ? parseFloat(body.totalMiles) : null;
    }
    if (body.pace !== undefined) {
      updateData.pace = body.pace?.trim() || null;
    }
    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }

    // Update the run
    if (Object.keys(updateData).length > 0) {
      const updated = await prisma.runCrewRun.update({
        where: { id: runId },
        data: updateData,
        include: {
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
      });

      return NextResponse.json({ success: true, run: updated });
    }

    return NextResponse.json({ success: true, run });
  } catch (err) {
    console.error('Error updating run:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/runcrew/[id]/runs/[runId] - Delete a run
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const { id, runId } = await params;
    if (!id || !runId) {
      return NextResponse.json({ error: 'Missing crew id or run id' }, { status: 400 });
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

    // Verify user is a member and has permission
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
    if (!membership || (membership.role !== 'admin' && membership.role !== 'manager')) {
      return NextResponse.json({ error: 'Forbidden - Admin or manager only' }, { status: 403 });
    }

    // Verify run exists and belongs to this crew
    const run = crew.runsBox?.runs?.find((r: any) => r.id === runId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Delete the run (cascade will delete RSVPs)
    const { prisma } = await import('@/lib/prisma');
    await prisma.runCrewRun.delete({
      where: { id: runId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting run:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

