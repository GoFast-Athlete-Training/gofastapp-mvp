export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/company/users
 * 
 * Returns all athletes/users for company admin management.
 * Called by GoFastCompany HQ for user management.
 * 
 * Authentication: Requires Firebase token
 * Authorization: Should be verified by GoFastCompany before calling
 */
export async function GET(request: Request) {
  try {
    // Verify Firebase token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch (err: any) {
      console.error('❌ COMPANY USERS: Token verification failed:', err?.message);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid token' 
      }, { status: 401 });
    }

    // Fetch all athletes with relevant fields
    const athletes = await prisma.athlete.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firebaseId: true,
        email: true,
        firstName: true,
        lastName: true,
        gofastHandle: true,
        birthday: true,
        gender: true,
        city: true,
        state: true,
        primarySport: true,
        photoURL: true,
        bio: true,
        instagram: true,
        createdAt: true,
        updatedAt: true,
        garmin_is_connected: true,
        garmin_user_id: true,
        garmin_connected_at: true,
        garmin_last_sync_at: true,
        companyId: true,
      },
    });

    // Format athletes to match GoFastCompany expected structure
    const formattedAthletes = athletes.map((athlete) => ({
      athleteId: athlete.id,
      id: athlete.id,
      firebaseId: athlete.firebaseId,
      email: athlete.email || '',
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
      status: 'active', // Default status
      createdAt: athlete.createdAt,
      updatedAt: athlete.updatedAt,
      fullName: athlete.firstName && athlete.lastName
        ? `${athlete.firstName} ${athlete.lastName}`
        : undefined,
      profileComplete: !!(athlete.firstName && athlete.lastName),
      daysSinceCreation: athlete.createdAt
        ? Math.floor((Date.now() - new Date(athlete.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      garmin: {
        connected: athlete.garmin_is_connected || false,
        userId: athlete.garmin_user_id || undefined,
        connectedAt: athlete.garmin_connected_at || undefined,
        lastSyncAt: athlete.garmin_last_sync_at || undefined,
        hasTokens: !!(athlete.garmin_user_id),
        tokenStatus: athlete.garmin_is_connected ? 'active' : 'disconnected',
      },
    }));

    return NextResponse.json({
      success: true,
      athletes: formattedAthletes,
      count: formattedAthletes.length,
    });
  } catch (err: any) {
    console.error('❌ COMPANY USERS: Error:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error',
      details: err?.message 
    }, { status: 500 });
  }
}

