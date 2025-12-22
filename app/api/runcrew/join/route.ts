export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { joinCrew, joinCrewById } from '@/lib/domain-runcrew';

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

    const { joinCode, crewId } = body;

    // Support both joinCode (legacy) and crewId (new InviteLink flow)
    if (!joinCode && !crewId) {
      return NextResponse.json(
        { error: 'Either joinCode or crewId is required' },
        { status: 400 }
      );
    }

    // Cannot provide both
    if (joinCode && crewId) {
      return NextResponse.json(
        { error: 'Provide either joinCode or crewId, not both' },
        { status: 400 }
      );
    }

    let crew;
    try {
      if (crewId) {
        // New InviteLink flow - join by crewId
        crew = await joinCrewById(crewId, athlete.id);
      } else {
        // Legacy flow - join by joinCode
        crew = await joinCrew(joinCode, athlete.id);
      }
    } catch (err: any) {
      console.error('Prisma error:', err);
      const errorMessage = err.message || 'DB error';
      
      // Handle "Crew not found" errors specifically
      if (errorMessage.includes('not found')) {
        return NextResponse.json(
          { error: errorMessage },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, runCrew: crew });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
