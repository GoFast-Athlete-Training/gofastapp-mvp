export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId, hydrateAthlete } from '@/lib/domain-athlete';

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ error: 'Auth unavailable' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;

    let athlete;
    try {
      athlete = await getAthleteByFirebaseId(firebaseId);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    let hydrated;
    try {
      hydrated = await hydrateAthlete(athlete.id);
    } catch (err: any) {
      console.error('❌ HYDRATE: Prisma error:', err);
      console.error('❌ HYDRATE: Error message:', err?.message);
      console.error('❌ HYDRATE: Error stack:', err?.stack);
      return NextResponse.json({ error: 'DB error', details: err?.message }, { status: 500 });
    }

    if (!hydrated) {
      console.error('❌ HYDRATE: hydrateAthlete returned null');
      return NextResponse.json({ error: 'Failed to hydrate' }, { status: 500 });
    }

    try {
      return NextResponse.json({ success: true, ...hydrated });
    } catch (serializeErr: any) {
      console.error('❌ HYDRATE: JSON serialization error:', serializeErr);
      console.error('❌ HYDRATE: Serialization error message:', serializeErr?.message);
      return NextResponse.json({ error: 'Serialization error', details: serializeErr?.message }, { status: 500 });
    }
  } catch (err: any) {
    console.error('❌ HYDRATE: Unexpected error:', err);
    console.error('❌ HYDRATE: Error message:', err?.message);
    console.error('❌ HYDRATE: Error stack:', err?.stack);
    return NextResponse.json({ error: 'Server error', details: err?.message }, { status: 500 });
  }
}
