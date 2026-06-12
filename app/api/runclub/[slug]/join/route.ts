export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { joinRunClubBySlug } from '@/lib/domain-runclub';

/**
 * POST /api/runclub/[slug]/join
 *
 * Join a run club. Does not RSVP to runs — club membership only.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
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

    const { slug } = await params;
    const result = await joinRunClubBySlug(slug, athlete.id);

    return NextResponse.json({
      success: true,
      club: result.club,
      membership: {
        id: result.membership.id,
        role: result.membership.role,
        status: result.membership.status,
        joinedAt: result.membership.joinedAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[POST /api/runclub/[slug]/join] Error:', error);
    if (error?.message === 'Run club not found') {
      return NextResponse.json({ error: 'Run club not found' }, { status: 404 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to join run club', details: error?.message },
      { status: 500 }
    );
  }
}
