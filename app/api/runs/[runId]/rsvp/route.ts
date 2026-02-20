export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { rsvpToRun } from '@/lib/domain-runcrew';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/runs/[runId]/rsvp
 * RSVP to a CityRun
 * 
 * Requires authentication - user must sign in to RSVP
 * CityRun is a universal run system (public or private)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    if (!runId) {
      return NextResponse.json({ error: 'Missing run id' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const { status, rsvpPhotoUrls } = body;
    if (!status || !['going', 'not-going'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be going or not-going' }, { status: 400 });
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

    // Verify CityRun exists
    const run = await prisma.city_runs.findUnique({
      where: { id: runId },
    });

    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    // Create or update RSVP (same function works for city_runs). Ambassadors: going + rsvpPhotoUrls = $10 credit.
    let rsvp;
    try {
      rsvp = await rsvpToRun({
        runId,
        athleteId: athlete.id,
        status: status as 'going' | 'not-going',
        rsvpPhotoUrls: Array.isArray(rsvpPhotoUrls) ? rsvpPhotoUrls : undefined,
      });
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, rsvp });
  } catch (err) {
    console.error('Error RSVPing to CityRun:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

