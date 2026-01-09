export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/company/runcrews
 * 
 * Returns all RunCrews for company admin management.
 * Called by GoFastCompany HQ for RunCrew management.
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
      console.error('❌ COMPANY RUNCREWS: Token verification failed:', err?.message);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid token' 
      }, { status: 401 });
    }

    // Fetch all RunCrews with member counts
    const runCrews = await prisma.run_crews.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            run_crew_memberships: true,
          },
        },
      },
    });

    // Format RunCrews for GoFastCompany
    const formattedRunCrews = runCrews.map((crew) => ({
      id: crew.id,
      name: crew.name,
      description: crew.description,
      logo: crew.logo,
      icon: crew.icon,
      city: crew.city,
      state: crew.state,
      paceRange: crew.paceRange,
      gender: crew.gender,
      ageRange: crew.ageRange,
      primaryMeetUpPoint: crew.primaryMeetUpPoint,
      primaryMeetUpAddress: crew.primaryMeetUpAddress,
      purpose: crew.purpose,
      timePreference: crew.timePreference,
      typicalRunMiles: crew.typicalRunMiles,
      joinCode: crew.joinCode,
      memberCount: crew._count.run_crew_memberships,
      createdAt: crew.createdAt,
      updatedAt: crew.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      runCrews: formattedRunCrews,
      count: formattedRunCrews.length,
    });
  } catch (err: any) {
    console.error('❌ COMPANY RUNCREWS: Error:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error',
      details: err?.message 
    }, { status: 500 });
  }
}

