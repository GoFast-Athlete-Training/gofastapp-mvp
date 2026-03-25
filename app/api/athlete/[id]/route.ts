export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteById, updateAthlete } from '@/lib/domain-athlete';
import { prisma } from '@/lib/prisma';
import { syncAthleteFiveKPaceToActivePlan } from '@/lib/training/plan-lifecycle';

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

    // Never send OAuth / test bearer tokens to the client
    const raw = athlete as Record<string, unknown>;
    const {
      garmin_access_token: _ga,
      garmin_refresh_token: _gr,
      garmin_test_access_token: _gt,
      ...athleteSafe
    } = raw;

    const athleteForClient = {
      ...athleteSafe,
      garmin_has_test_token: !!(athlete.garmin_test_access_token && athlete.garmin_test_access_token.length > 0),
    };

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
      const keys = Object.keys(body || {});
      if (
        keys.length === 1 &&
        keys[0] === 'garmin_test_linked_email'
      ) {
        const v = body.garmin_test_linked_email;
        const normalized =
          v === null || v === undefined || v === ''
            ? null
            : String(v).trim().slice(0, 320);
        updated = await prisma.athlete.update({
          where: { id },
          data: {
            garmin_test_linked_email: normalized,
            updatedAt: new Date(),
          },
        });
      } else {
        updated = await updateAthlete(id, body);
        if (body && typeof body === 'object' && 'fiveKPace' in body) {
          await syncAthleteFiveKPaceToActivePlan(id);
        }
      }
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    const raw = updated as Record<string, unknown>;
    const {
      garmin_access_token: _ga,
      garmin_refresh_token: _gr,
      garmin_test_access_token: _gt,
      ...athleteSafe
    } = raw;

    return NextResponse.json({
      success: true,
      athlete: {
        ...athleteSafe,
        garmin_has_test_token: !!(
          updated.garmin_test_access_token &&
          updated.garmin_test_access_token.length > 0
        ),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
