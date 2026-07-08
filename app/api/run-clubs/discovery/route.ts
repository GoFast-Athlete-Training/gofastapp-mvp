export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getDiscoveryRunClubs } from '@/lib/domain-run-clubs-discovery';

/**
 * GET /api/run-clubs/discovery
 *
 * Authenticated app club directory for Group Runs "By club".
 * Lists Product run_clubs with upcoming discovery run metadata.
 *
 * Query params:
 * - citySlug (optional)
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

    const clubs = await getDiscoveryRunClubs({ citySlug });

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
