export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getAthleteByFirebaseId, getAthleteById } from '@/lib/domain-athlete';

/** POST /api/athlete/[id]/container/leave — [id] = host athlete id */
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

    await prisma.gofast_container_memberships.deleteMany({
      where: {
        containerAthleteId: host.id,
        memberAthleteId: member.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('container/leave:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
