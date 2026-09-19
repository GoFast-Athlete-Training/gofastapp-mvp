export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getDiscoveryRunClubs } from '@/lib/domain-run-clubs-discovery';
import {
  hasDiscoveryLocationScope,
  parseDiscoveryLocationParams,
} from '@/lib/discovery-location';

/**
 * GET /api/run-clubs/discovery
 *
 * Authenticated app club directory for Group Runs "By club".
 * Lists Product run_clubs with upcoming discovery run metadata.
 *
 * Query params:
 * - citySlug | gofastCity | athleteCity (+ athleteState)
 * - regionSlug
 */
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const location = parseDiscoveryLocationParams(searchParams);

    if (!hasDiscoveryLocationScope(location)) {
      return NextResponse.json(
        { success: false, error: 'citySlug, regionSlug, or runClubSlug is required' },
        { status: 400 }
      );
    }

    const clubs = await getDiscoveryRunClubs({
      citySlug: location.citySlug,
      regionSlug: location.regionSlug,
    });

    return NextResponse.json({
      success: true,
      clubs,
    });
  } catch (error: any) {
    console.error('Error fetching discovery run clubs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch discovery run clubs', details: error?.message },
      { status: 500 }
    );
  }
}
