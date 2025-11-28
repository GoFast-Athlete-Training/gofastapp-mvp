export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { joinCrew } from '@/lib/domain-runcrew';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyFirebaseIdToken(token);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const firebaseId = decodedToken.uid;

    // Find athlete
    const athlete = await getAthleteByFirebaseId(firebaseId);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const body = await request.json();
    const { joinCode } = body;

    if (!joinCode) {
      return NextResponse.json(
        { error: 'joinCode is required' },
        { status: 400 }
      );
    }

    const crew = await joinCrew(joinCode, athlete.id);

    return NextResponse.json({ success: true, runCrew: crew });
  } catch (error: any) {
    console.error('Error joining crew:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to join crew' },
      { status: 500 }
    );
  }
}

