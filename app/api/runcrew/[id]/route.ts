export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { hydrateCrew } from '@/lib/domain-runcrew';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing crew id' }, { status: 400 });
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

    // Just hydrate - welcome page is the gate, let it through
    let crew;
    try {
      crew = await hydrateCrew(id, athlete.id);
    } catch (err: any) {
      console.error('❌ RUNCREW GET: Prisma error:', err);
      console.error('❌ RUNCREW GET: Error message:', err?.message);
      console.error('❌ RUNCREW GET: Error stack:', err?.stack);
      return NextResponse.json({ error: 'DB error', details: err?.message }, { status: 500 });
    }

    if (!crew) {
      console.error('❌ RUNCREW GET: Crew not found for id:', id);
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    try {
      // Ensure proper JSON serialization by converting Date objects
      const serializedCrew = JSON.parse(JSON.stringify(crew, (key, value) => {
        // Convert Date objects to ISO strings
        if (value instanceof Date) {
          return value.toISOString();
        }
        // Handle BigInt if present
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      }));
      
      return NextResponse.json({ success: true, runCrew: serializedCrew });
    } catch (serializeErr: any) {
      console.error('❌ RUNCREW GET: JSON serialization error:', serializeErr);
      console.error('❌ RUNCREW GET: Serialization error message:', serializeErr?.message);
      console.error('❌ RUNCREW GET: Crew data type:', typeof crew);
      console.error('❌ RUNCREW GET: Crew keys:', crew ? Object.keys(crew) : 'null');
      return NextResponse.json({ error: 'Serialization error', details: serializeErr?.message }, { status: 500 });
    }
  } catch (err: any) {
    console.error('❌ RUNCREW GET: Unexpected error:', err);
    console.error('❌ RUNCREW GET: Error message:', err?.message);
    console.error('❌ RUNCREW GET: Error stack:', err?.stack);
    return NextResponse.json({ error: 'Server error', details: err?.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing crew id' }, { status: 400 });
    }

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

    let crew;
    try {
      crew = await hydrateCrew(id, athlete.id);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    // Verify user is admin
    const membership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.athleteId === athlete.id
    );
    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    // Update message topics if provided
    if (body.messageTopics && Array.isArray(body.messageTopics)) {
      const { prisma } = await import('@/lib/prisma');
      try {
        await prisma.runCrew.update({
          where: { id },
          data: {
            messageTopics: body.messageTopics,
          },
        });
      } catch (err: any) {
        // If messageTopics column doesn't exist, log warning but don't fail
        if (err?.code === 'P2022' || err?.message?.includes('messageTopics')) {
          console.warn('⚠️ RUNCREW PUT: messageTopics column not found, skipping update. Run migration to add column.');
        } else {
          throw err; // Re-throw if it's a different error
        }
      }
    }

    // Reload crew data
    const updatedCrew = await hydrateCrew(id, athlete.id);
    return NextResponse.json({ success: true, runCrew: updatedCrew });
  } catch (err) {
    console.error('Error updating crew:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
