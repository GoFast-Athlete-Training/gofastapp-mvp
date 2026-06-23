export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * GET /api/clubowner/preview
 * Public copy for generic club-owner landing.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    title: 'Manage your run club on GoFast',
    description:
      'Sign up or sign in with the email GoFast has on file for your club. After your athlete profile is set up, we will connect you to your club manager tools.',
    entryPath: '/clubowner',
    signupPath: '/signup?mode=club-owner',
  });
}
