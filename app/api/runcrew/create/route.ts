export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { createCrew } from '@/lib/domain-runcrew';

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

    const { 
      name, 
      description, 
      joinCode,
      city,
      state,
      paceMin,
      paceMax,
      gender,
      ageMin,
      ageMax,
      primaryMeetUpPoint,
      primaryMeetUpAddress,
      primaryMeetUpPlaceId,
      primaryMeetUpLat,
      primaryMeetUpLng,
    } = body;

    if (!name || !joinCode) {
      return NextResponse.json(
        { error: 'Name and joinCode are required' },
        { status: 400 }
      );
    }

    let crew;
    try {
      crew = await createCrew({
        name,
        description,
        joinCode,
        athleteId: athlete.id,
        city,
        state,
        paceMin: paceMin ? parseInt(paceMin) : undefined,
        paceMax: paceMax ? parseInt(paceMax) : undefined,
        gender: gender || undefined,
        ageMin: ageMin ? parseInt(ageMin) : undefined,
        ageMax: ageMax ? parseInt(ageMax) : undefined,
        primaryMeetUpPoint,
        primaryMeetUpAddress,
        primaryMeetUpPlaceId,
        primaryMeetUpLat: primaryMeetUpLat ? parseFloat(primaryMeetUpLat) : undefined,
        primaryMeetUpLng: primaryMeetUpLng ? parseFloat(primaryMeetUpLng) : undefined,
      });
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, runCrew: crew });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
