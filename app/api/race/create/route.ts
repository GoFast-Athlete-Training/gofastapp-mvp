export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { metersToMiles } from '@/lib/pace-utils';

const PRESET_BY_KEY: Record<
  string,
  { distanceLabel: string; distanceMeters: number }
> = {
  '5k': { distanceLabel: '5K', distanceMeters: 5000 },
  '10k': { distanceLabel: '10K', distanceMeters: 10000 },
  '10m': { distanceLabel: '10 Mile', distanceMeters: 16093 },
  half: { distanceLabel: 'Half Marathon', distanceMeters: 21097 },
  marathon: { distanceLabel: 'Marathon', distanceMeters: 42195 },
  ultra: { distanceLabel: 'Ultra', distanceMeters: 80467 },
};

function pushRaceToCompanyUpstream(
  race: {
    id: string;
    name: string;
    raceDate: Date;
    city: string | null;
    state: string | null;
    registrationUrl: string | null;
    distanceLabel: string;
    distanceMeters: number;
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
    raceType: race.distanceLabel,
    distanceMiles: metersToMiles(race.distanceMeters),
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

    const finalRaceType = (raceType?.toLowerCase() || '5k') as string;
    const preset =
      PRESET_BY_KEY[finalRaceType] ?? PRESET_BY_KEY['5k'];

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
          distanceLabel: preset.distanceLabel,
          distanceMeters: preset.distanceMeters,
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
        distanceLabel: race.distanceLabel ?? preset.distanceLabel,
        distanceMeters: race.distanceMeters ?? preset.distanceMeters,
      },
      authHeader
    );

    return NextResponse.json({
      success: true,
      race: {
        id: race.id,
        name: race.name,
        distanceLabel: race.distanceLabel,
        distanceMeters: race.distanceMeters,
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
