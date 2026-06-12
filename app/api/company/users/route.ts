export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { formatCompanyUser } from '@/lib/format-company-user';

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
 * GET /api/company/users
 *
 * Returns all athletes/users for company admin management.
 * Called by GoFastCompany HQ for user management.
 */
export async function GET(request: Request) {
  try {
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
      console.error('❌ COMPANY USERS: Token verification failed:', message);
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401, headers: corsHeaders }
      );
    }

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
        lastSeenAt: true,
        garmin_access_token: true,
        garmin_user_id: true,
        garmin_connected_at: true,
        garmin_last_sync_at: true,
        companyId: true,
      },
    });

    const formattedAthletes = athletes.map(formatCompanyUser);

    return NextResponse.json(
      {
        success: true,
        athletes: formattedAthletes,
        count: formattedAthletes.length,
      },
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('❌ COMPANY USERS: Error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error', details: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
