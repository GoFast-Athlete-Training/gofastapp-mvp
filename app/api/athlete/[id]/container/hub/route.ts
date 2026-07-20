export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { loadContainerHubForHost } from '@/lib/gofast-with-me/container-hub-service';
import { isValidContainerTopic } from '@/lib/gofast-with-me/container-topics';

/** GET /api/athlete/[id]/container/hub — authenticated member hub boot payload */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hostAthleteId } = await params;
    if (!hostAthleteId) {
      return NextResponse.json({ success: false, error: 'Missing host id' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
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

    const { searchParams } = new URL(request.url);
    const topicParam = searchParams.get('topic')?.trim();
    const messageTopic =
      topicParam && isValidContainerTopic(topicParam) ? topicParam : undefined;

    const hub = await loadContainerHubForHost(hostAthleteId, caller.id, {
      messageTopic,
      messageLimit: 40,
    });

    if (!hub) {
      return NextResponse.json({ success: false, error: 'Hub not available' }, { status: 404 });
    }

    return NextResponse.json({ success: true, hub });
  } catch (e) {
    console.error('container/hub GET:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
