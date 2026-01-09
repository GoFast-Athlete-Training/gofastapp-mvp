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
    const formattedRunCrews = runCrews.map((crew) => {
      // Format pace range from easyMilesPace and crushingItPace
      let paceRange = null;
      if (crew.easyMilesPace && crew.crushingItPace) {
        const easyMin = Math.floor(crew.easyMilesPace / 60);
        const easySec = crew.easyMilesPace % 60;
        const crushMin = Math.floor(crew.crushingItPace / 60);
        const crushSec = crew.crushingItPace % 60;
        paceRange = `${crushMin}:${crushSec.toString().padStart(2, '0')}-${easyMin}:${easySec.toString().padStart(2, '0')}/mile`;
      } else if (crew.easyMilesPace) {
        const easyMin = Math.floor(crew.easyMilesPace / 60);
        const easySec = crew.easyMilesPace % 60;
        paceRange = `~${easyMin}:${easySec.toString().padStart(2, '0')}/mile`;
      }

      // Format age range
      let ageRange = null;
      if (crew.ageMin && crew.ageMax) {
        ageRange = `${crew.ageMin}-${crew.ageMax}`;
      } else if (crew.ageMin) {
        ageRange = `${crew.ageMin}+`;
      } else if (crew.ageMax) {
        ageRange = `up to ${crew.ageMax}`;
      }

      return {
        id: crew.id,
        name: crew.name,
        description: crew.description,
        logo: crew.logo,
        icon: crew.icon,
        city: crew.city,
        state: crew.state,
        paceRange,
        gender: crew.gender,
        ageRange,
        ageMin: crew.ageMin,
        ageMax: crew.ageMax,
        easyMilesPace: crew.easyMilesPace,
        crushingItPace: crew.crushingItPace,
        primaryMeetUpPoint: crew.primaryMeetUpPoint,
        primaryMeetUpAddress: crew.primaryMeetUpAddress,
        purpose: crew.purpose,
        timePreference: crew.timePreference,
        typicalRunMiles: crew.typicalRunMiles,
        longRunMilesMin: crew.longRunMilesMin,
        longRunMilesMax: crew.longRunMilesMax,
        joinCode: crew.joinCode,
        handle: crew.handle,
        memberCount: crew._count.run_crew_memberships,
        createdAt: crew.createdAt,
        updatedAt: crew.updatedAt,
      };
    });

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

