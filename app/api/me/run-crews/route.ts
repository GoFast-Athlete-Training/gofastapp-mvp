export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { getAthleteIdFromCookie } from '@/lib/server/cookies';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/me/run-crews
 * 
 * Returns all RunCrew memberships for the current athlete.
 * Uses athleteId from cookie (Phase 1 pattern).
 * 
 * Returns:
 * {
 *   success: true,
 *   runCrews: [
 *     {
 *       membershipId: string,
 *       runCrewId: string,
 *       runCrewName: string,
 *       role: 'MEMBER' | 'ADMIN'
 *     }
 *   ]
 * }
 */
export async function GET(request: Request) {
  try {
    // 1. Verify Firebase token (for authentication)
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

    // 2. Get athleteId from cookie
    const athleteId = await getAthleteIdFromCookie();
    if (!athleteId) {
      return NextResponse.json({ error: 'Athlete ID not found in cookie' }, { status: 401 });
    }

    // 3. Verify athlete exists and Firebase ID matches (authorization)
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    if (athlete.id !== athleteId) {
      return NextResponse.json({ error: 'Athlete ID mismatch' }, { status: 403 });
    }

    // 4. Fetch RunCrew memberships with role information
    const memberships = await prisma.runCrewMembership.findMany({
      where: { athleteId },
      include: {
        runCrew: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 5. Get admin roles for this athlete
    const managerRecords = await prisma.runCrewManager.findMany({
      where: { athleteId },
      select: {
        runCrewId: true,
        role: true,
      },
    });

    // 6. Format response - explicitly set 'MEMBER' for all non-admin members
    const runCrews = memberships.map((membership) => {
      const managerRecord = managerRecords.find(
        (m) => m.runCrewId === membership.runCrewId
      );
      
      // Explicitly set role: 'ADMIN' only if manager record exists AND role is 'admin', otherwise 'MEMBER'
      const role: 'MEMBER' | 'ADMIN' = (managerRecord && managerRecord.role === 'admin')
        ? 'ADMIN'
        : 'MEMBER';

      return {
        membershipId: membership.id,
        runCrewId: membership.runCrewId,
        runCrewName: membership.runCrew.name,
        role,
      };
    });

    return NextResponse.json({
      success: true,
      runCrews,
    });
  } catch (err: any) {
    console.error('❌ GET /api/me/run-crews error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

