export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/runs/[runId]/messages/[messageId]
 * Edit a message. Owner only.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ runId: string; messageId: string }> }
) {
  try {
    const { runId, messageId } = await params;
    if (!runId || !messageId) {
      return NextResponse.json({ error: 'Missing run id or message id' }, { status: 400 });
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

    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const message = await prisma.city_run_messages.findUnique({ where: { id: messageId } });
    if (!message || message.runId !== runId) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (message.athleteId !== athlete.id) {
      return NextResponse.json({ error: 'Forbidden - can only edit your own messages' }, { status: 403 });
    }

    const { content } = body;
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const updated = await prisma.city_run_messages.update({
      where: { id: messageId },
      data: { content: content.trim(), updatedAt: new Date() },
      include: {
        Athlete: {
          select: { id: true, firstName: true, lastName: true, photoURL: true },
        },
      },
    });

    return NextResponse.json({ success: true, message: updated });
  } catch (err) {
    console.error('Error updating city run message:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/runs/[runId]/messages/[messageId]
 * Delete a message. Owner only.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ runId: string; messageId: string }> }
) {
  try {
    const { runId, messageId } = await params;
    if (!runId || !messageId) {
      return NextResponse.json({ error: 'Missing run id or message id' }, { status: 400 });
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

    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const message = await prisma.city_run_messages.findUnique({ where: { id: messageId } });
    if (!message || message.runId !== runId) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (message.athleteId !== athlete.id) {
      return NextResponse.json({ error: 'Forbidden - can only delete your own messages' }, { status: 403 });
    }

    await prisma.city_run_messages.delete({ where: { id: messageId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting city run message:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
