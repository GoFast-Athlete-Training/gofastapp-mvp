export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { createCrew } from '@/lib/domain-runcrew';

export async function POST(request: NextRequest) {
  try {
    // 2️⃣ Get admin auth (may be null during build)
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      console.warn('⚠️ Firebase admin not initialized. Skipping auth.');
      return NextResponse.json(
        { error: 'Auth unavailable' },
        { status: 500 }
      );
    }

    // 3️⃣ Extract token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // 4️⃣ Verify token safely
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch (err) {
      console.error('❌ Token verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const firebaseId = decoded.uid;

    // Find athlete
    const athlete = await getAthleteByFirebaseId(firebaseId);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, joinCode } = body;

    if (!name || !joinCode) {
      return NextResponse.json(
        { error: 'Name and joinCode are required' },
        { status: 400 }
      );
    }

    const crew = await createCrew({
      name,
      description,
      joinCode,
      athleteId: athlete.id,
    });

    return NextResponse.json({ success: true, runCrew: crew });
  } catch (err: any) {
    console.error('❌ API ERROR:', err);
    return NextResponse.json(
      { error: 'Server error', detail: err.message },
      { status: 500 }
    );
  }
}
