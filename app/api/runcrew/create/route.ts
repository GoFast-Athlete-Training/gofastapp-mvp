export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { createCrew } from '@/lib/domain-runcrew';
import { validatePaceFormat, paceToSeconds } from '@/utils/formatPace';

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

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

    const firebaseId = decodedToken.uid;

    let athlete;
    try {
      athlete = await getAthleteByFirebaseId(firebaseId);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const { 
      name, 
      handle,
      description, 
      city,
      state,
      easyMilesPace,
      crushingItPace,
      gender,
      ageMin,
      ageMax,
      primaryMeetUpPoint,
      primaryMeetUpAddress,
      primaryMeetUpPlaceId,
      primaryMeetUpLat,
      primaryMeetUpLng,
      purpose,
      timePreference,
      typicalRunMiles,
      longRunMilesMin,
      longRunMilesMax,
      trainingForRace,
      trainingForDistance,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Validate handle format if provided
    if (handle) {
      const normalizedHandle = handle.toLowerCase().trim();
      const handleRegex = /^[a-z0-9-]+$/;
      
      if (!handleRegex.test(normalizedHandle)) {
        return NextResponse.json(
          { error: 'Handle can only contain lowercase letters, numbers, and hyphens' },
          { status: 400 }
        );
      }
      
      if (normalizedHandle.length < 3) {
        return NextResponse.json(
          { error: 'Handle must be at least 3 characters long' },
          { status: 400 }
        );
      }
      
      if (normalizedHandle.length > 50) {
        return NextResponse.json(
          { error: 'Handle must be 50 characters or less' },
          { status: 400 }
        );
      }
      
      if (normalizedHandle.startsWith('-') || normalizedHandle.endsWith('-')) {
        return NextResponse.json(
          { error: 'Handle cannot start or end with a hyphen' },
          { status: 400 }
        );
      }
    }

    // Validate and convert pace fields from MM:SS to seconds
    let easyMilesPaceSeconds: number | undefined;
    let crushingItPaceSeconds: number | undefined;

    if (easyMilesPace) {
      if (!validatePaceFormat(easyMilesPace)) {
        return NextResponse.json(
          { error: 'Easy Miles pace must be in MM:SS format (e.g., 8:00)' },
          { status: 400 }
        );
      }
      const seconds = paceToSeconds(easyMilesPace);
      if (seconds !== null) {
        easyMilesPaceSeconds = seconds;
      }
    }

    if (crushingItPace) {
      if (!validatePaceFormat(crushingItPace)) {
        return NextResponse.json(
          { error: 'Crushing It pace must be in MM:SS format (e.g., 7:00)' },
          { status: 400 }
        );
      }
      const seconds = paceToSeconds(crushingItPace);
      if (seconds !== null) {
        crushingItPaceSeconds = seconds;
      }
    }

    let crew;
    try {
      crew = await createCrew({
        name,
        handle: handle ? handle.toLowerCase().trim() : undefined,
        description,
        athleteId: athlete.id,
        city,
        state,
        easyMilesPace: easyMilesPaceSeconds,
        crushingItPace: crushingItPaceSeconds,
        gender: gender || undefined,
        ageMin: ageMin ? parseInt(ageMin) : undefined,
        ageMax: ageMax ? parseInt(ageMax) : undefined,
        primaryMeetUpPoint,
        primaryMeetUpAddress,
        primaryMeetUpPlaceId,
        primaryMeetUpLat: primaryMeetUpLat ? parseFloat(primaryMeetUpLat) : undefined,
        primaryMeetUpLng: primaryMeetUpLng ? parseFloat(primaryMeetUpLng) : undefined,
        purpose: Array.isArray(purpose) && purpose.length > 0 ? purpose : undefined,
        timePreference: Array.isArray(timePreference) && timePreference.length > 0 ? timePreference : undefined,
        typicalRunMiles: typicalRunMiles ? parseFloat(typicalRunMiles) : undefined,
        longRunMilesMin: longRunMilesMin ? parseFloat(longRunMilesMin) : undefined,
        longRunMilesMax: longRunMilesMax ? parseFloat(longRunMilesMax) : undefined,
        trainingForRace: trainingForRace || undefined,
        trainingForDistance: Array.isArray(trainingForDistance) && trainingForDistance.length > 0 ? trainingForDistance : undefined,
      });
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, runCrew: crew });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
