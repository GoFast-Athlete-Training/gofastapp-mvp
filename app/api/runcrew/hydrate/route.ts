export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
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
      crew = await hydrateCrew(runCrewId);
    } catch (err: any) {
      console.error('❌ RUNCREW HYDRATE: Prisma error:', err);
      console.error('❌ RUNCREW HYDRATE: Error message:', err?.message);
      console.error('❌ RUNCREW HYDRATE: Error stack:', err?.stack);
      return NextResponse.json({ error: 'DB error', details: err?.message }, { status: 500 });
    }

    if (!crew) {
      console.error('❌ RUNCREW HYDRATE: Crew not found for runCrewId:', runCrewId);
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    // Verify user is a member of the crew (using box structure)
    const isMember = crew.membershipsBox?.memberships?.some(
      (membership: any) => membership.athleteId === athlete.id
    );
    if (!isMember) {
      console.error('❌ RUNCREW HYDRATE: User is not a member of crew:', runCrewId, 'athleteId:', athlete.id);
      return NextResponse.json({ error: 'Forbidden - You are not a member of this crew' }, { status: 403 });
    }

    try {
      return NextResponse.json({ success: true, runCrew: crew });
    } catch (serializeErr: any) {
      console.error('❌ RUNCREW HYDRATE: JSON serialization error:', serializeErr);
      return NextResponse.json({ error: 'Serialization error', details: serializeErr?.message }, { status: 500 });
    }
  } catch (err: any) {
    console.error('❌ RUNCREW HYDRATE: Unexpected error:', err);
    console.error('❌ RUNCREW HYDRATE: Error message:', err?.message);
    return NextResponse.json({ error: 'Server error', details: err?.message }, { status: 500 });
  }
}
