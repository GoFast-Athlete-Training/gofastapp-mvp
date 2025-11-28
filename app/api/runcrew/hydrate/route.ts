export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { hydrateCrew } from '@/lib/domain-runcrew';

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

    const { runCrewId } = body;

    if (!runCrewId) {
      return NextResponse.json(
        { error: 'runCrewId is required' },
        { status: 400 }
      );
    }

    let crew;
    try {
      crew = await hydrateCrew(runCrewId, athlete.id);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, runCrew: crew });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
