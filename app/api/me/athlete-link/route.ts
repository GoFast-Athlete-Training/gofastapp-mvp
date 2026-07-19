export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';

/**
 * POST /api/me/athlete-link
 * Step 1 of manager invite accept: confirm Firebase user is linked to an Athlete row.
 * Create the athlete via POST /api/athlete/create if this returns 404.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    const athlete = await getAthleteByFirebaseId(decoded.uid);
    if (!athlete) {
      return NextResponse.json(
        {
          success: false,
          code: 'ATHLETE_NOT_LINKED',
          error: 'No athlete profile linked to this account yet',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      linked: true,
      athleteId: athlete.id,
      email: athlete.email ?? decoded.email ?? null,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
  }
}
