export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { loadAthleteProfileHydrationByHandle } from '@/lib/server/load-athlete-profile-hydration';

/**
 * GET /api/athlete/profile-preview/[handle]
 * Public, unauthenticated. Minimal athlete profile hydration for mobile Profile + chat taps.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: raw } = await params;
    const payload = await loadAthleteProfileHydrationByHandle(raw || '');

    if (!payload) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...payload });
  } catch (e: unknown) {
    console.error('GET /api/athlete/profile-preview/[handle]:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
