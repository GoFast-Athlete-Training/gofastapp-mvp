export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteById } from '@/lib/domain-athlete';
import { unpublishActivityPost } from '@/lib/gofast-with-me/activity-posts';

async function requireOwnedAthlete(request: Request, athleteId: string) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
  } catch {
    return { error: NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 }) };
  }

  const athlete = await getAthleteById(athleteId);
  if (!athlete) {
    return { error: NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 }) };
  }
  if (athlete.firebaseId !== decodedToken.uid) {
    return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { athlete };
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  try {
    const { id: athleteId, postId } = await params;
    if (!athleteId || !postId) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    }

    const auth = await requireOwnedAthlete(request, athleteId);
    if ('error' in auth) return auth.error;

    const ok = await unpublishActivityPost(athleteId, postId);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('athlete/activity-posts DELETE:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
