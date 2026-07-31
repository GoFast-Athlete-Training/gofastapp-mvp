export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { lookupAthletesByEmail } from '@/lib/domain-club-manager-staff-assign';
import { assertStaffBearerAuth } from '@/lib/training/training-engine-auth';

/**
 * GET /api/internal/athletes/by-email?email=
 * Company → Product: find existing GoFast athletes for manager assignment.
 */
export async function GET(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const email = request.nextUrl.searchParams.get('email')?.trim();
  if (!email) {
    return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 });
  }

  try {
    const athletes = await lookupAthletesByEmail(email);
    return NextResponse.json({
      success: true,
      found: athletes.length > 0,
      athletes,
    });
  } catch (err: unknown) {
    console.error('[GET /api/internal/athletes/by-email]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to lookup athlete',
        details: err instanceof Error ? err.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
