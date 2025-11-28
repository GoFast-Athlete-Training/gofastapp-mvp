export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { hydrateCrew, postMessage } from '@/lib/domain-runcrew';

export async function GET(
  request: NextRequest,
  { params }: { params: { id?: string } }
) {
  try {
    // 1️⃣ Prevent build-time errors: params undefined during static eval
    if (!params?.id) {
      return NextResponse.json({ error: 'Missing crew id' }, { status: 400 });
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
    const crew = await hydrateCrew(params.id);
    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, messages: crew.messages });
  } catch (err: any) {
    console.error('❌ API ERROR:', err);
    return NextResponse.json(
      { error: 'Server error', detail: err.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id?: string } }
) {
  try {
    // 1️⃣ Prevent build-time errors: params undefined during static eval
    if (!params?.id) {
      return NextResponse.json({ error: 'Missing crew id' }, { status: 400 });
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

    const firebaseId = decoded.uid;

    // Find athlete
    const athlete = await getAthleteByFirebaseId(firebaseId);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const message = await postMessage({
      runCrewId: params.id,
      athleteId: athlete.id,
      content,
    });

    return NextResponse.json({ success: true, message });
  } catch (err: any) {
    console.error('❌ API ERROR:', err);
    return NextResponse.json(
      { error: 'Server error', detail: err.message },
      { status: 500 }
    );
  }
}
