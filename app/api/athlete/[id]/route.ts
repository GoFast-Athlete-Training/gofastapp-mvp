export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getAthleteById, updateAthlete } from '@/lib/domain-athlete';

export async function GET(
  request: NextRequest,
  { params }: { params: { id?: string } }
) {
  try {
    // 1️⃣ Prevent build-time errors: params undefined during static eval
    if (!params?.id) {
      return NextResponse.json({ error: 'Missing athlete id' }, { status: 400 });
    }

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

    // 5️⃣ Real DB query
    const athlete = await getAthleteById(params.id);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, athlete });
  } catch (err: any) {
    console.error('❌ API ERROR:', err);
    return NextResponse.json(
      { error: 'Server error', detail: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id?: string } }
) {
  try {
    // 1️⃣ Prevent build-time errors: params undefined during static eval
    if (!params?.id) {
      return NextResponse.json({ error: 'Missing athlete id' }, { status: 400 });
    }

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

    // Verify athlete owns this profile
    const athlete = await getAthleteById(params.id);
    if (!athlete || athlete.firebaseId !== decoded.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const updated = await updateAthlete(params.id, body);

    return NextResponse.json({ success: true, athlete: updated });
  } catch (err: any) {
    console.error('❌ API ERROR:', err);
    return NextResponse.json(
      { error: 'Server error', detail: err.message },
      { status: 500 }
    );
  }
}
