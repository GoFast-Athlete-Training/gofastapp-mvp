export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { hydrateCrew } from '@/lib/domain-runcrew';

// PUT /api/runcrew/[id]/messages/[messageId] - Edit a message
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id, messageId } = await params;
    if (!id || !messageId) {
      return NextResponse.json({ error: 'Missing crew id or message id' }, { status: 400 });
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

    // Verify user is a member
    const membership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.athleteId === athlete.id
    );
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the message
    const { prisma } = await import('@/lib/prisma');
    const message = await prisma.runCrewMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Verify message belongs to this crew
    if (message.runCrewId !== id) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Check permissions: user can edit own messages, admin can edit any
    const isAdmin = membership.role === 'admin';
    const isOwner = message.athleteId === athlete.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Can only edit your own messages' }, { status: 403 });
    }

    const { content } = body;
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Update the message
    const updated = await prisma.runCrewMessage.update({
      where: { id: messageId },
      data: { content: content.trim() },
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
    });

    return NextResponse.json({ success: true, message: updated });
  } catch (err) {
    console.error('Error updating message:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/runcrew/[id]/messages/[messageId] - Delete a message
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id, messageId } = await params;
    if (!id || !messageId) {
      return NextResponse.json({ error: 'Missing crew id or message id' }, { status: 400 });
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

    // Verify user is a member
    const membership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.athleteId === athlete.id
    );
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the message
    const { prisma } = await import('@/lib/prisma');
    const message = await prisma.runCrewMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Verify message belongs to this crew
    if (message.runCrewId !== id) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Check permissions: user can delete own messages, admin can delete any
    const isAdmin = membership.role === 'admin';
    const isOwner = message.athleteId === athlete.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Can only delete your own messages' }, { status: 403 });
    }

    // Delete the message
    await prisma.runCrewMessage.delete({
      where: { id: messageId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting message:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

