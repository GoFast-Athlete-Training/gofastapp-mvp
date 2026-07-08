export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getDiscoveryRuns } from '@/lib/domain-runs';

/**
 * GET /api/runs/discovery
 *
 * Authenticated app discovery surface for Group Runs.
 * Returns Product club runs without SEO `published` gating.
 *
 * Query params:
 * - citySlug (optional)
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
    const citySlug =
      searchParams.get('citySlug')?.trim() ||
      searchParams.get('gofastCity')?.trim() ||
      undefined;
    const day = searchParams.get('day') || undefined;
    const runClubSlug = searchParams.get('runClubSlug') || undefined;

    const runs = await getDiscoveryRuns({ citySlug, day, runClubSlug });

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
