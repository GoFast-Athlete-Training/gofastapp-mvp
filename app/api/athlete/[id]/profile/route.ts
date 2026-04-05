export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getAthleteById, updateAthlete } from '@/lib/domain-athlete';
import { syncAthleteFiveKPaceToActivePlan } from '@/lib/training/plan-lifecycle';

/** GET /api/athlete/[id]/profile — same row as GET /api/athlete/[id] (auth: own athlete only) */
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

    const athlete = await getAthleteById(id);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }
    if (athlete.firebaseId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ success: true, athlete });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;
    const { id: athleteId } = await params;

    if (!athleteId) {
      return NextResponse.json({ success: false, error: 'Athlete ID required' }, { status: 400 });
    }

    // Verify athlete exists and belongs to this Firebase user
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
    });

    if (!athlete) {
      return NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 });
    }

    if (athlete.firebaseId !== firebaseId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Forbidden',
        message: 'You can only update your own profile'
      }, { status: 403 });
    }

    // Partial update: only keys present on the body are applied (tab saves / onboarding).
    const data: Record<string, unknown> = {};
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
    const trimReq = (v: unknown) => String(v ?? '').trim();

    if (has('firstName')) {
      const v = trimReq(body.firstName);
      if (!v) {
        return NextResponse.json(
          { success: false, error: 'Invalid firstName', message: 'First name is required when provided' },
          { status: 400 }
        );
      }
      data.firstName = v;
    }
    if (has('lastName')) {
      const v = trimReq(body.lastName);
      if (!v) {
        return NextResponse.json(
          { success: false, error: 'Invalid lastName', message: 'Last name is required when provided' },
          { status: 400 }
        );
      }
      data.lastName = v;
    }
    if (has('gofastHandle')) {
      const v = trimReq(body.gofastHandle).toLowerCase();
      if (!v) {
        return NextResponse.json(
          { success: false, error: 'Invalid gofastHandle', message: 'Handle is required when provided' },
          { status: 400 }
        );
      }
      if (v !== athlete.gofastHandle) {
        const existing = await prisma.athlete.findUnique({
          where: { gofastHandle: v },
        });
        if (existing) {
          return NextResponse.json({
            success: false,
            error: 'Handle taken',
            field: 'gofastHandle',
            message: `Handle "@${v}" is already taken`,
          }, { status: 400 });
        }
      }
      data.gofastHandle = v;
    }
    if (has('birthday')) {
      if (!body.birthday) {
        return NextResponse.json(
          { success: false, error: 'Invalid birthday', message: 'Birthday is required when provided' },
          { status: 400 }
        );
      }
      data.birthday = new Date(body.birthday);
    }
    if (has('gender')) {
      const v = trimReq(body.gender);
      if (!v) {
        return NextResponse.json(
          { success: false, error: 'Invalid gender', message: 'Gender is required when provided' },
          { status: 400 }
        );
      }
      data.gender = v;
    }
    if (has('city')) {
      const v = trimReq(body.city);
      if (!v) {
        return NextResponse.json(
          { success: false, error: 'Invalid city', message: 'City is required when provided' },
          { status: 400 }
        );
      }
      data.city = v;
    }
    if (has('state')) {
      const v = trimReq(body.state);
      if (!v) {
        return NextResponse.json(
          { success: false, error: 'Invalid state', message: 'State is required when provided' },
          { status: 400 }
        );
      }
      data.state = v;
    }
    if (has('phoneNumber')) {
      data.phoneNumber =
        body.phoneNumber == null || body.phoneNumber === '' ? null : String(body.phoneNumber);
    }
    if (has('primarySport')) {
      data.primarySport =
        body.primarySport == null || trimReq(body.primarySport) === ''
          ? null
          : trimReq(body.primarySport);
    }
    if (has('bio')) {
      data.bio = body.bio == null || trimReq(body.bio) === '' ? null : trimReq(body.bio);
    }
    if (has('instagram')) {
      data.instagram =
        body.instagram == null || trimReq(body.instagram) === '' ? null : trimReq(body.instagram);
    }
    if (has('photoURL')) {
      data.photoURL = body.photoURL == null || body.photoURL === '' ? null : String(body.photoURL);
    }
    if (has('myBestRunPhotoURL')) {
      data.myBestRunPhotoURL =
        body.myBestRunPhotoURL == null || body.myBestRunPhotoURL === ''
          ? null
          : String(body.myBestRunPhotoURL);
    }
    if (has('fiveKPace')) {
      data.fiveKPace = body.fiveKPace === '' || body.fiveKPace == null ? null : body.fiveKPace;
    }
    if (has('weeklyMileage')) {
      data.weeklyMileage =
        body.weeklyMileage == null || body.weeklyMileage === ''
          ? null
          : Number(body.weeklyMileage);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update', message: 'Provide at least one field to update' },
        { status: 400 }
      );
    }

    const updated = await updateAthlete(athleteId, data);

    if (has('fiveKPace')) {
      await syncAthleteFiveKPaceToActivePlan(athleteId);
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      athleteId: updated.id,
      athlete: updated,
    });
  } catch (err: any) {
    console.error('❌ PROFILE UPDATE: Error:', err);
    
    // Handle Prisma unique constraint violations (P2002)
    if (err?.code === 'P2002') {
      const target = err?.meta?.target;
      if (Array.isArray(target) && target.includes('gofastHandle')) {
        // Get handle from error meta if available, otherwise use generic message
        const handleFromError = err?.meta?.targetValue || 'this handle';
        return NextResponse.json({ 
          success: false, 
          error: 'Handle taken',
          field: 'gofastHandle',
          message: `Handle "@${handleFromError}" is already taken`
        }, { status: 400 });
      }
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Server error', 
      details: err?.message 
    }, { status: 500 });
  }
}

