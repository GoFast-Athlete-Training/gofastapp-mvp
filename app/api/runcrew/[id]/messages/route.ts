export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { hydrateCrew, postMessage } from '@/lib/domain-runcrew';

// GET removed - use GET /api/runcrew/[id] for hydration (returns all boxes including messagesBox)

export async function POST(
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
      crew = await hydrateCrew(id);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    // Verify user is a member of the crew (using box structure)
    const membership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.athleteId === athlete.id
    );
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { content, topic } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    let message;
    try {
      message = await postMessage({
        runCrewId: id,
        athleteId: athlete.id,
        content,
        topic: topic || 'general', // Default to 'general' if not provided
      });
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Note: PUT and DELETE for individual messages are handled in /api/runcrew/[id]/messages/[messageId]/route.ts
