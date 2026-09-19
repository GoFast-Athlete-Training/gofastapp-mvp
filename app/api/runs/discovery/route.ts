export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getDiscoveryRuns } from '@/lib/domain-runs';
import {
  hasDiscoveryLocationScope,
  parseDiscoveryLocationParams,
} from '@/lib/discovery-location';

/**
 * GET /api/runs/discovery
 *
 * Authenticated app discovery surface for Group Runs.
 * Returns Product club runs without SEO `published` gating.
 *
 * Query params:
 * - citySlug | gofastCity | athleteCity (+ athleteState)
 * - regionSlug — metro reel-in (e.g. dc)
 * - day (optional) — weekday name
 * - runClubSlug (optional)
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
    const day = searchParams.get('day') || undefined;

    if (!hasDiscoveryLocationScope(location)) {
      return NextResponse.json(
        { success: false, error: 'citySlug, regionSlug, or runClubSlug is required' },
        { status: 400 }
      );
    }

    const runs = await getDiscoveryRuns({
      citySlug: location.citySlug,
      regionSlug: location.regionSlug,
      day,
      runClubSlug: location.runClubSlug,
    });

    return NextResponse.json({
      success: true,
      runs,
    });
  } catch (error: any) {
    console.error('Error fetching discovery runs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch discovery runs', details: error?.message },
      { status: 500 }
    );
  }
}
