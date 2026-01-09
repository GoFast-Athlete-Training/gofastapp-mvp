export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getAthleteById } from '@/lib/domain-athlete';

// CORS headers for GoFastCompany HQ
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Handle OPTIONS preflight request
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/company/users/[id]
 * 
 * Returns a specific athlete/user by ID for company admin management.
 * Called by GoFastCompany HQ for user details.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ 
        success: false,
        error: 'Missing user id' 
      }, { status: 400 });
    }

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
      console.error('❌ COMPANY USERS GET: Token verification failed:', err?.message);
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid token' 
        },
        { status: 401, headers: corsHeaders }
      );
    }

    // Fetch athlete
    const athlete = await getAthleteById(id);

    if (!athlete) {
      return NextResponse.json(
        { 
          success: false,
          error: 'User not found' 
        },
        { status: 404, headers: corsHeaders }
      );
    }

    // Format athlete to match GoFastCompany expected structure
    const formattedAthlete = {
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
      status: 'active',
      createdAt: athlete.createdAt,
      updatedAt: athlete.updatedAt,
      fullName: athlete.firstName && athlete.lastName
        ? `${athlete.firstName} ${athlete.lastName}`
        : undefined,
      profileComplete: !!(athlete.firstName && athlete.lastName),
      garmin: {
        connected: athlete.garmin_is_connected || false,
        userId: athlete.garmin_user_id || undefined,
        connectedAt: athlete.garmin_connected_at || undefined,
        lastSyncAt: athlete.garmin_last_sync_at || undefined,
        hasTokens: !!(athlete.garmin_user_id),
        tokenStatus: athlete.garmin_is_connected ? 'active' : 'disconnected',
      },
    };

    return NextResponse.json(
      {
        success: true,
        athlete: formattedAthlete,
        data: formattedAthlete, // Support both formats
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('❌ COMPANY USERS GET: Error:', err);
    return NextResponse.json(
      { 
        success: false,
        error: 'Server error',
        details: err?.message 
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/company/users/[id]
 * 
 * Deletes a specific athlete/user by ID.
 * Called by GoFastCompany HQ for user management.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
      if (!id) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Missing user id' 
          },
          { status: 400, headers: corsHeaders }
        );
      }

      // Verify Firebase token
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Unauthorized' 
          },
          { status: 401, headers: corsHeaders }
        );
      }

      let decodedToken;
      try {
        decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
      } catch (err: any) {
        console.error('❌ COMPANY USERS DELETE: Token verification failed:', err?.message);
        return NextResponse.json(
          { 
            success: false,
            error: 'Invalid token' 
          },
          { status: 401, headers: corsHeaders }
        );
      }

      // Check if athlete exists
      const athlete = await getAthleteById(id);
      if (!athlete) {
        return NextResponse.json(
          { 
            success: false,
            error: 'User not found' 
          },
          { status: 404, headers: corsHeaders }
        );
      }

    // Delete athlete (cascade will handle related records)
    await prisma.athlete.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'User deleted successfully',
        data: {
          athleteId: athlete.id,
          email: athlete.email,
        },
        deletedData: {
          athleteId: athlete.id,
          email: athlete.email,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('❌ COMPANY USERS DELETE: Error:', err);
    return NextResponse.json(
      { 
        success: false,
        error: 'Server error',
        details: err?.message 
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

