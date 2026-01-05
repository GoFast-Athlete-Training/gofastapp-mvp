export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { hydrateCrew } from '@/lib/domain-runcrew';

// PUT /api/runcrew/[id]/announcements/[announcementId] - Edit an announcement
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; announcementId: string }> }
) {
  try {
    const { id, announcementId } = await params;
    if (!id || !announcementId) {
      return NextResponse.json({ error: 'Missing crew id or announcement id' }, { status: 400 });
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
      crew = await hydrateCrew(id);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    // Verify user is admin or manager
    const membership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.athleteId === athlete.id
    );
    if (!membership || (membership.role !== 'admin' && membership.role !== 'manager')) {
      return NextResponse.json({ error: 'Forbidden - Admin or manager only' }, { status: 403 });
    }

    // Get the announcement
    const { prisma } = await import('@/lib/prisma');
    const announcement = await prisma.run_crew_announcements.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    // Verify announcement belongs to this crew
    if (announcement.runCrewId !== id) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    const { title, content } = body;
    if (!title || !content || !title.trim() || !content.trim()) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    // Update the announcement
    const updated = await prisma.run_crew_announcements.update({
      where: { id: announcementId },
      data: {
        title: title.trim(),
        content: content.trim(),
      },
      include: {
        Athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoURL: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, announcement: updated });
  } catch (err) {
    console.error('Error updating announcement:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/runcrew/[id]/announcements/[announcementId] - Delete (archive) an announcement
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; announcementId: string }> }
) {
  try {
    const { id, announcementId } = await params;
    if (!id || !announcementId) {
      return NextResponse.json({ error: 'Missing crew id or announcement id' }, { status: 400 });
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
      crew = await hydrateCrew(id);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    // Verify user is admin or manager
    const membership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.athleteId === athlete.id
    );
    if (!membership || (membership.role !== 'admin' && membership.role !== 'manager')) {
      return NextResponse.json({ error: 'Forbidden - Admin or manager only' }, { status: 403 });
    }

    // Get the announcement
    const { prisma } = await import('@/lib/prisma');
    const announcement = await prisma.run_crew_announcements.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    // Verify announcement belongs to this crew
    if (announcement.runCrewId !== id) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    // Archive the announcement (don't delete, so it can be retrieved)
    // Set archivedAt timestamp - if null, announcement is active; if set, it's archived
    const archived = await prisma.run_crew_announcements.update({
      where: { id: announcementId },
      data: {
        archivedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error archiving announcement:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

