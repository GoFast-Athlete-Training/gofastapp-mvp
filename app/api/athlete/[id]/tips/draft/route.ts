export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteById } from '@/lib/domain-athlete';
import { draftAthleteTipFromAbout } from '@/lib/gofast-with-me/draft-athlete-tip';

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: athleteId } = await params;
    if (!athleteId) {
      return NextResponse.json({ success: false, error: 'Missing athlete id' }, { status: 400 });
    }

    const auth = await requireOwnedAthlete(request, athleteId);
    if ('error' in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const about = typeof body.about === 'string' ? body.about.trim() : '';
    if (!about) {
      return NextResponse.json({ success: false, error: 'about is required' }, { status: 400 });
    }
    if (about.length > 2000) {
      return NextResponse.json({ success: false, error: 'about too long' }, { status: 400 });
    }

    const draft = await draftAthleteTipFromAbout(about);
    if (!draft) {
      return NextResponse.json(
        { success: false, error: 'Could not draft tip — try manual or try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, title: draft.title, body: draft.body });
  } catch (e) {
    console.error('athlete/tips/draft POST:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
