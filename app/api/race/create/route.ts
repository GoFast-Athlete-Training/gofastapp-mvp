export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

function pushRaceToCompanyUpstream(
  race: {
    id: string;
    name: string;
    raceDate: Date;
    city: string | null;
    state: string | null;
    registrationUrl: string | null;
    raceType: string;
    distanceMiles: number;
  },
  authHeader: string | null
) {
  const raw =
    process.env.NEXT_PUBLIC_COMPANY_APP_URL ||
    process.env.GOFAST_COMPANY_API_URL ||
    '';
  const base = raw.replace(/\/$/, '');
  if (!base) return;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  const body = JSON.stringify({
    prodRaceId: race.id,
    name: race.name,
    raceDate: race.raceDate.toISOString(),
    cityName: race.city,
    state: race.state,
    registrationUrl: race.registrationUrl,
    raceType: race.raceType,
    distanceMiles: race.distanceMiles,
  });

  void fetch(`${base}/api/race-registrations/create`, {
    method: 'POST',
    headers,
    body,
  }).catch(() => {
    /* non-blocking */
  });
}

// Generate a simple unique ID (cuid-like format)
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { name, raceType, date, city, state, country } = body;

    if (!name || !date) {
      return NextResponse.json(
        { success: false, error: 'Race name and date are required' },
        { status: 400 }
      );
    }

    // Calculate miles from raceType
    const milesMap: { [key: string]: number } = {
      '5k': 3.1,
      '10k': 6.2,
      '10m': 10,
      'half': 13.1,
      'marathon': 26.2,
      'ultra': 50, // Default for ultra
    };

    const finalRaceType = raceType?.toLowerCase() || '5k';
    const distanceMiles = milesMap[finalRaceType] || 3.1;

    // Parse date string and create UTC date (race dates are date-only)
    const raceDate = new Date(date);
    raceDate.setUTCHours(0, 0, 0, 0);

    // REGISTRY PATTERN: Find or create race (upsert)
    // Check for existing race with same name and date
    let race = await prisma.race_registry.findFirst({
      where: {
        name: name.trim(),
        raceDate: raceDate,
      },
    });

    if (!race) {
      // Create new race in registry
      race = await prisma.race_registry.create({
        data: {
          id: generateId(),
          name: name.trim(),
          raceType: finalRaceType,
          distanceMiles: distanceMiles,
          raceDate: raceDate,
          city: city || null,
          state: state || null,
          country: country || 'USA',
          updatedAt: new Date(),
        },
      });
    }

    pushRaceToCompanyUpstream(
      {
        id: race.id,
        name: race.name,
        raceDate: race.raceDate,
        city: race.city,
        state: race.state,
        registrationUrl: race.registrationUrl ?? null,
        raceType: race.raceType,
        distanceMiles: race.distanceMiles,
      },
      authHeader
    );

    return NextResponse.json({
      success: true,
      race: {
        id: race.id,
        name: race.name,
        raceType: race.raceType,
        distanceMiles: race.distanceMiles,
        raceDate: race.raceDate,
        city: race.city,
        state: race.state,
        country: race.country,
      },
    });
  } catch (error: any) {
    console.error('❌ RACE CREATE: Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create race', 
        details: error?.message || 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

