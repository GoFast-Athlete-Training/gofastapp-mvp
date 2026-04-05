export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getAthleteByFirebaseId, getAthleteById } from '@/lib/domain-athlete';

/** DELETE /api/athlete/[id]/container/messages/[messageId] — container host only */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id: hostAthleteId, messageId } = await params;
    if (!hostAthleteId || !messageId) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    }

    const authHeader = _request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const caller = await getAthleteByFirebaseId(decodedToken.uid);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 });
    }

    const host = await getAthleteById(hostAthleteId);
    if (!host?.isGoFastContainer || host.id !== caller.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await prisma.gofast_container_messages.deleteMany({
      where: {
        id: messageId,
        containerAthleteId: host.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('container/messages DELETE:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
