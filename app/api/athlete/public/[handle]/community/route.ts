export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { loadAthleteCommunityByHandle } from '@/lib/gofast-with-me/container-hub-service';
import { isValidContainerTopic } from '@/lib/gofast-with-me/container-topics';

/**
 * GET /api/athlete/public/[handle]/community
 * Public read of an athlete's GoFast With Me community.
 * Optional Bearer token adds isOwner / isFollowing / canParticipate for the caller.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: raw } = await params;
    if (!raw?.trim()) {
      return NextResponse.json({ success: false, error: 'Missing handle' }, { status: 400 });
    }

    let callerAthleteId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
        const caller = await getAthleteByFirebaseId(decoded.uid);
        callerAthleteId = caller?.id ?? null;
      } catch {
        /* anonymous read remains valid */
      }
    }

    const { searchParams } = new URL(request.url);
    const topicParam = searchParams.get('topic')?.trim();
    const messageTopic =
      topicParam && isValidContainerTopic(topicParam) ? topicParam : undefined;

    const community = await loadAthleteCommunityByHandle(raw, callerAthleteId, {
      messageTopic,
      messageLimit: 40,
    });

    if (!community) {
      return NextResponse.json({ success: false, error: 'Community not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, community });
  } catch (e) {
    console.error('GET /api/athlete/public/[handle]/community:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
