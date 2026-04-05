export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getAthleteByFirebaseId, getAthleteById } from '@/lib/domain-athlete';

/** POST /api/athlete/[id]/container/join — [id] = host athlete id */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hostAthleteId } = await params;
    if (!hostAthleteId) {
      return NextResponse.json({ success: false, error: 'Missing host id' }, { status: 400 });
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

    const member = await getAthleteByFirebaseId(decodedToken.uid);
    if (!member) {
      return NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 });
    }

    const host = await getAthleteById(hostAthleteId);
    if (!host) {
      return NextResponse.json({ success: false, error: 'Container not found' }, { status: 404 });
    }
    if (!host.isGoFastContainer) {
      return NextResponse.json(
        { success: false, error: 'This page is not a GoFast Container' },
        { status: 400 }
      );
    }
    if (member.id === host.id) {
      return NextResponse.json(
        { success: false, error: 'Host is already the owner of this container' },
        { status: 400 }
      );
    }

    await prisma.gofast_container_memberships.upsert({
      where: {
        containerAthleteId_memberAthleteId: {
          containerAthleteId: host.id,
          memberAthleteId: member.id,
        },
      },
      create: {
        containerAthleteId: host.id,
        memberAthleteId: member.id,
        role: 'member',
      },
      update: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('container/join:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
