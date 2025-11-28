export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { updateGarminConnection } from '@/lib/domain-garmin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.redirect(new URL('/settings/garmin?error=no_code', request.url));
    }

    // Exchange code for token (simplified - you'll need to implement full OAuth flow)
    // This is a placeholder - you'll need to call Garmin's token endpoint
    const clientId = process.env.GARMIN_CLIENT_ID;
    const clientSecret = process.env.GARMIN_CLIENT_SECRET;
    const redirectUri = process.env.GARMIN_REDIRECT_URI;

    // TODO: Implement full OAuth token exchange
    // For now, redirect to success page
    return NextResponse.redirect(new URL('/settings/garmin/success', request.url));
  } catch (error: any) {
    console.error('Error in Garmin callback:', error);
    return NextResponse.redirect(new URL('/settings/garmin?error=callback_failed', request.url));
  }
}

