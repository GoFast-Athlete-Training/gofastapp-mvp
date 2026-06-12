export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteById } from '@/lib/domain-athlete';
import { formatAthleteToProfileCard } from '@/lib/format-company-profile-card';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

async function fetchFirebaseLastSignIn(firebaseId: string): Promise<string | null> {
  try {
    const firebaseUser = await adminAuth.getUser(firebaseId);
    return firebaseUser.metadata.lastSignInTime ?? null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('⚠️ PROFILE CARD: Firebase getUser failed for', firebaseId, message);
    return null;
  }
}

/**
 * GET /api/company/users/[id]/profile-card
 *
 * Rich profile card payload for GoFastCompany HQ user admin.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing user id' },
        { status: 400, headers: corsHeaders }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid token';
      console.error('❌ PROFILE CARD: Token verification failed:', message);
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401, headers: corsHeaders }
      );
    }

    const athlete = await getAthleteById(id);
    if (!athlete) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const lastSignInAt = await fetchFirebaseLastSignIn(athlete.firebaseId);

    const profileCard = formatAthleteToProfileCard(
      {
        id: athlete.id,
        firebaseId: athlete.firebaseId,
        email: athlete.email,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        gofastHandle: athlete.gofastHandle,
        birthday: athlete.birthday,
        gender: athlete.gender,
        city: athlete.city,
        state: athlete.state,
        primarySport: athlete.primarySport,
        photoURL: athlete.photoURL,
        bio: athlete.bio,
        instagram: athlete.instagram,
        createdAt: athlete.createdAt,
        updatedAt: athlete.updatedAt,
        lastSeenAt: (athlete as { lastSeenAt?: Date | null }).lastSeenAt ?? null,
        garmin_access_token: athlete.garmin_access_token,
        garmin_user_id: athlete.garmin_user_id,
        garmin_connected_at: athlete.garmin_connected_at,
        garmin_last_sync_at: athlete.garmin_last_sync_at,
      },
      lastSignInAt
    );

    return NextResponse.json(
      { success: true, profileCard },
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('❌ PROFILE CARD: Error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error', details: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
