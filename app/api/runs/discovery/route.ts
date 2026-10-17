export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDiscoveryRuns } from '@/lib/domain-runs';
import { discoveryLocationFromAthlete } from '@/lib/discovery-athlete-scope';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';

/**
 * GET /api/runs/discovery
 *
 * Authenticated Find a Run list. Location scope comes from the athlete profile
 * (DMV region or single city). Client citySlug / regionSlug params are ignored.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const location = discoveryLocationFromAthlete({
      city: auth.athlete.city,
      state: auth.athlete.state,
    });

    if (!location) {
      return NextResponse.json(
        {
          success: false,
          error: 'Add your city to your profile to find runs near you.',
          code: 'missing_athlete_city',
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const day = searchParams.get('day') || undefined;

    const runs = await getDiscoveryRuns({
      citySlug: location.citySlug,
      regionSlug: location.regionSlug,
      day,
    });

    return NextResponse.json({
      success: true,
      runs,
      scope: location,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching discovery runs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch discovery runs', details: message },
      { status: 500 }
    );
  }
}
