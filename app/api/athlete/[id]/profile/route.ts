export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { updateAthlete } from '@/lib/domain-athlete';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
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
    const athleteId = params?.id;

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

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.gofastHandle || !body.birthday || !body.gender || !body.city || !body.state || !body.primarySport) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields',
        message: 'All required fields must be provided'
      }, { status: 400 });
    }

    // Check if gofastHandle is unique (if changed)
    if (body.gofastHandle && body.gofastHandle !== athlete.gofastHandle) {
      const existing = await prisma.athlete.findUnique({
        where: { gofastHandle: body.gofastHandle },
      });

      if (existing) {
        return NextResponse.json({ 
          success: false, 
          error: 'Handle taken',
          field: 'gofastHandle',
          message: `Handle "@${body.gofastHandle}" is already taken`
        }, { status: 400 });
      }
    }

    // Update athlete profile
    const updated = await updateAthlete(athleteId, {
      firstName: body.firstName,
      lastName: body.lastName,
      phoneNumber: body.phoneNumber || null,
      gofastHandle: body.gofastHandle,
      birthday: body.birthday ? new Date(body.birthday) : null,
      gender: body.gender,
      city: body.city,
      state: body.state,
      primarySport: body.primarySport,
      bio: body.bio || null,
      instagram: body.instagram || null,
      photoURL: body.photoURL || null,
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      athleteId: updated.id,
      athlete: updated,
    });
  } catch (err: any) {
    console.error('❌ PROFILE UPDATE: Error:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error', 
      details: err?.message 
    }, { status: 500 });
  }
}

