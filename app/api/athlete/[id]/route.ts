export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteById, updateAthlete } from '@/lib/domain-athlete';
import { syncAthleteFiveKPaceToActivePlan } from '@/lib/training/plan-lifecycle';
import { ensureAthleteProfileSnapshot } from '@/lib/athlete-profile-snapshot';
import { buildAthleteForClient } from '@/lib/athlete-for-client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing athlete id' }, { status: 400 });
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

    let athlete;
    try {
      athlete = await getAthleteById(id);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Verify user can only access their own athlete data
    if (athlete.firebaseId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ensureAthleteProfileSnapshot(id);

    let athleteRow;
    try {
      athleteRow = await getAthleteById(id);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!athleteRow) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const athleteForClient = await buildAthleteForClient(
      athleteRow as Record<string, unknown> & { id: string; garmin_access_token?: string | null }
    );

    return NextResponse.json({ success: true, athlete: athleteForClient });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing athlete id' }, { status: 400 });
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

    let athlete;
    try {
      athlete = await getAthleteById(id);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!athlete || athlete.firebaseId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let updated;
    try {
      updated = await updateAthlete(id, body);
      if (body && typeof body === 'object' && 'fiveKPace' in body) {
        await syncAthleteFiveKPaceToActivePlan(id);
      }
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    const athleteForClient = await buildAthleteForClient(
      updated as Record<string, unknown> & { id: string; garmin_access_token?: string | null }
    );

    return NextResponse.json({
      success: true,
      athlete: athleteForClient,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
