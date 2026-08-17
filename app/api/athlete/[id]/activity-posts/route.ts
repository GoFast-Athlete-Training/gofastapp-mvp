export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteById } from '@/lib/domain-athlete';
import {
  getActivityPostForActivity,
  normalizeActivityPostInput,
  upsertActivityPost,
  validateActivityPostInput,
} from '@/lib/gofast-with-me/activity-posts';

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
  if (!athlete.isGoFastContainer) {
    return {
      error: NextResponse.json(
        { success: false, error: 'GoFast With Me community is not enabled for this athlete' },
        { status: 403 }
      ),
    };
  }

  return { athlete };
}

export async function GET(
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

    const activityId = new URL(request.url).searchParams.get('activityId')?.trim();
    if (!activityId) {
      return NextResponse.json({ success: false, error: 'activityId query param required' }, { status: 400 });
    }

    const post = await getActivityPostForActivity(athleteId, activityId);
    return NextResponse.json({ success: true, post });
  } catch (e) {
    console.error('athlete/activity-posts GET:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
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

    const input = normalizeActivityPostInput(await request.json().catch(() => ({})));
    const validationError = validateActivityPostInput(input);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const post = await upsertActivityPost(athleteId, input);
    return NextResponse.json({ success: true, post });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    if (message === 'Activity not found') {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    console.error('athlete/activity-posts POST:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
