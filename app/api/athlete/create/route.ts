import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebaseAdmin';
import { createAthlete, getAthleteByFirebaseId } from '@/lib/domain-athlete';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyFirebaseIdToken(token);
    const firebaseId = decodedToken.uid;

    const body = await request.json();
    const { email, firstName, lastName } = body;

    // Check if athlete already exists
    const existing = await getAthleteByFirebaseId(firebaseId);
    if (existing) {
      return NextResponse.json({ success: true, athlete: existing });
    }

    // Create new athlete
    const athlete = await createAthlete({
      firebaseId,
      email,
      firstName,
      lastName,
    });

    return NextResponse.json({ success: true, athlete });
  } catch (error: any) {
    console.error('Error creating athlete:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create athlete' },
      { status: 500 }
    );
  }
}

