export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { hydrateAthlete } from '@/lib/domain-athlete';

export async function POST(request: Request) {
  const timestamp = new Date().toISOString();
  const method = request.method;
  let firebaseId: string | null = null;

  try {
    const authR = await requireAthleteFromBearer(request);
    if ('error' in authR) {
      const st = authR.status;
      console.error(`❌ HYDRATE [${timestamp}]: Auth failed: ${authR.error} (${st})`);
      return NextResponse.json(
        { success: false, error: authR.error },
        { status: st === 400 ? 400 : st }
      );
    }
    const athlete = authR.athlete;
    firebaseId = athlete.firebaseId;
    console.log(`✅ HYDRATE [${timestamp}]: Session verified athleteId=${athlete.id} firebaseUid=${firebaseId}`);

    // Hydrate athlete
    let hydrated;
    try {
      hydrated = await hydrateAthlete(athlete.id);
    } catch (err: any) {
      console.error(`❌ HYDRATE [${timestamp}]: Prisma error hydrating:`, err?.message);
      console.error(`❌ HYDRATE [${timestamp}]: UID: ${firebaseId}`);
      console.error(`❌ HYDRATE [${timestamp}]: Athlete ID: ${athlete.id}`);
      console.error(`❌ HYDRATE [${timestamp}]: Method: ${method}`);
      console.error(`❌ HYDRATE [${timestamp}]: Stack:`, err?.stack);
      return NextResponse.json({ 
        success: false, 
        error: 'Hydration failed' 
      }, { status: 500 });
    }

    if (!hydrated) {
      console.error(`❌ HYDRATE [${timestamp}]: hydrateAthlete returned null for UID: ${firebaseId}`);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to hydrate' 
      }, { status: 500 });
    }

    // Extract athlete data (already formatted by domain function)
    const athleteData = hydrated.athlete || {};
    
    // Debug logging for memberships
    console.log(`🔍 HYDRATE [${timestamp}]: Athlete has ${athleteData.runCrewMemberships?.length || 0} memberships`);
    console.log(`🔍 HYDRATE [${timestamp}]: Memberships:`, JSON.stringify(athleteData.runCrewMemberships?.map((m: any) => ({
      id: m.id,
      role: m.role,
      runCrewId: m.runCrewId,
      runCrewName: m.runCrew?.name || m.run_crews?.name || 'N/A'
    })), null, 2));

    // { success, athlete, timestamp } for app bootstrap / shell
    return NextResponse.json({ 
      success: true,
      message: 'Athlete hydrated successfully',
      athlete: athleteData,
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error(`❌ HYDRATE [${timestamp}]: Unexpected error:`, err?.message);
    console.error(`❌ HYDRATE [${timestamp}]: UID: ${firebaseId || 'unknown'}`);
    console.error(`❌ HYDRATE [${timestamp}]: Method: ${method}`);
    console.error(`❌ HYDRATE [${timestamp}]: Stack:`, err?.stack);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error' 
    }, { status: 500 });
  }
}
