export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getAthleteByFirebaseId, getAthleteById } from '@/lib/domain-athlete';

/**
 * GET /api/athlete/[id]/container/status
 * Optional auth. [id] = host athlete id. Returns whether caller is host or member.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hostAthleteId } = await params;
    if (!hostAthleteId) {
      return NextResponse.json({ success: false, error: 'Missing host id' }, { status: 400 });
    }

    const host = await getAthleteById(hostAthleteId);
    if (!host) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    if (!host.isGoFastContainer) {
      return NextResponse.json({
        success: true,
        isGoFastContainer: false,
        isHost: false,
        isMember: false,
      });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        success: true,
        isGoFastContainer: true,
        isHost: false,
        isMember: false,
      });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({
        success: true,
        isGoFastContainer: true,
        isHost: false,
        isMember: false,
      });
    }

    const caller = await getAthleteByFirebaseId(decodedToken.uid);
    if (!caller) {
      return NextResponse.json({
        success: true,
        isGoFastContainer: true,
        isHost: false,
        isMember: false,
      });
    }

    const isHost = caller.id === host.id;
    if (isHost) {
      return NextResponse.json({
        success: true,
        isGoFastContainer: true,
        isHost: true,
        isMember: true,
      });
    }

    const m = await prisma.gofast_container_memberships.findUnique({
      where: {
        containerAthleteId_memberAthleteId: {
          containerAthleteId: host.id,
          memberAthleteId: caller.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      isGoFastContainer: true,
      isHost: false,
      isMember: !!m,
    });
  } catch (e) {
    console.error('container/status GET:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
