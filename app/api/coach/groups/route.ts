export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getCoachByFirebaseId } from '@/lib/domain-coach';

/** GET /api/coach/groups — training cohorts for this coach (pending cohort↔coach wiring). */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    const coach = await getCoachByFirebaseId(decoded.uid);
    if (!coach) {
      return NextResponse.json({ success: false, error: 'Coach not found' }, { status: 404 });
    }

    // training_cohorts replaced race_trainer_groups; coach assignment TBD.
    return NextResponse.json({ success: true, groups: [] });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
  }
}
