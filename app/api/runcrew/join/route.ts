export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { joinCrewById } from '@/lib/domain-runcrew';

/**
 * POST /api/runcrew/join
 * 
 * Join a RunCrew by crewId
 * Requires authentication
 * 
 * Request body:
 * {
 *   "crewId": "clx123abc",
 *   "athleteId": "optional - from localStorage"
 * }
 * 
 * Returns:
 * {
 *   "success": true,
 *   "runCrew": { ... }
 * }
 */
export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { crewId, athleteId: bodyAthleteId } = body;

    if (!crewId) {
      return NextResponse.json({ error: 'Missing crewId' }, { status: 400 });
    }

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

    // Use athleteId from body (localStorage) if provided, otherwise use athlete from Firebase lookup
    // Verify that bodyAthleteId matches authenticated athlete for security
    const finalAthleteId = bodyAthleteId && bodyAthleteId === athlete.id 
      ? bodyAthleteId 
      : athlete.id;

    // Join crew by crewId
    let crew;
    try {
      crew = await joinCrewById(crewId, finalAthleteId);
    } catch (err: any) {
      console.error('❌ RUNCREW JOIN: Error joining crew:', err);
      if (err.message === 'Crew not found') {
        return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to join crew', details: err?.message }, { status: 500 });
    }

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    try {
      // Ensure proper JSON serialization
      const serializedCrew = JSON.parse(JSON.stringify(crew, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      }));
      
      return NextResponse.json({ success: true, runCrew: serializedCrew });
    } catch (serializeErr: any) {
      console.error('❌ RUNCREW JOIN: JSON serialization error:', serializeErr);
      return NextResponse.json({ error: 'Serialization error', details: serializeErr?.message }, { status: 500 });
    }
  } catch (err: any) {
    console.error('❌ RUNCREW JOIN: Unexpected error:', err);
    return NextResponse.json({ error: 'Server error', details: err?.message }, { status: 500 });
  }
}

