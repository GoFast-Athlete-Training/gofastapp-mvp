export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId, hydrateAthlete } from '@/lib/domain-athlete';

export async function POST(request: Request) {
  const timestamp = new Date().toISOString();
  const method = request.method;
  let firebaseId: string | null = null;

  try {
    // Parse body safely
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    // Get Firebase UID from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error(`❌ HYDRATE [${timestamp}]: Missing or invalid auth header`);
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Initialize Firebase Admin
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      console.error(`❌ HYDRATE [${timestamp}]: Firebase Admin unavailable`);
      return NextResponse.json({ 
        success: false, 
        error: 'Auth unavailable' 
      }, { status: 500 });
    }

    // Verify token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
      firebaseId = decodedToken.uid;
      console.log(`✅ HYDRATE [${timestamp}]: Token verified for UID: ${firebaseId}`);
    } catch (err: any) {
      console.error(`❌ HYDRATE [${timestamp}]: Token verification failed:`, err?.message);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid token' 
      }, { status: 401 });
    }

    // Find athlete
    let athlete;
    try {
      athlete = await getAthleteByFirebaseId(firebaseId);
    } catch (err: any) {
      console.error(`❌ HYDRATE [${timestamp}]: Prisma error finding athlete:`, err?.message);
      console.error(`❌ HYDRATE [${timestamp}]: UID: ${firebaseId}`);
      console.error(`❌ HYDRATE [${timestamp}]: Method: ${method}`);
      console.error(`❌ HYDRATE [${timestamp}]: Stack:`, err?.stack);
      return NextResponse.json({ 
        success: false, 
        error: 'Database error' 
      }, { status: 500 });
    }

    // Athlete not found - return 404 with success: false
    if (!athlete) {
      console.log(`⚠️ HYDRATE [${timestamp}]: Athlete not found for UID: ${firebaseId}`);
      return NextResponse.json({ 
        success: false, 
        error: 'Athlete not found' 
      }, { status: 404 });
    }

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

    // Extract data safely
    const athleteData = hydrated.athlete || {};
    const weeklyActivities = athleteData.weeklyActivities || [];
    const weeklyTotals = athleteData.weeklyTotals || null;

    // Return success response
    return NextResponse.json({ 
      success: true,
      athlete: athleteData,
      weeklyActivities,
      weeklyTotals
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
