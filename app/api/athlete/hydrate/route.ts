import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId, hydrateAthlete } from '@/lib/domain-athlete';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyFirebaseIdToken(token);
    const firebaseId = decodedToken.uid;

    // Find athlete by Firebase ID
    const athlete = await getAthleteByFirebaseId(firebaseId);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Hydrate athlete data
    const hydrated = await hydrateAthlete(athlete.id);
    if (!hydrated) {
      return NextResponse.json({ error: 'Failed to hydrate' }, { status: 500 });
    }

    return NextResponse.json({ success: true, ...hydrated });
  } catch (error: any) {
    console.error('Error hydrating athlete:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to hydrate athlete' },
      { status: 500 }
    );
  }
}

