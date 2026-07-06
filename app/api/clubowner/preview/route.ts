export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * GET /api/clubowner/preview
 * Public copy for generic club-owner landing.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    title: 'Club Manager on GoFast',
    description:
      'Open your manager activation link or sign in with the email GoFast has on file for your club.',
    entryPath: '/club-manager/activate',
    signupPath: '/signup?mode=club-manager',
  });
}
