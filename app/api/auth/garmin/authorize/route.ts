export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  buildGarminAuthUrl,
  generatePKCE,
  getGarminCookieOptions,
  getGarminOAuthServerUrl,
  getGarminRedirectUri,
  getGarminVerifierCookieName,
} from '@/lib/garmin-oauth';

/**
 * GET /api/auth/garmin/authorize?athleteId=xxx
 *
 * Starts OAuth handshake with Garmin using PKCE flow.
 * Returns JSON with authorization URL (client opens popup).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const athleteId = url.searchParams.get('athleteId');

    if (!athleteId) {
      return NextResponse.json({ error: 'athleteId is required' }, { status: 400 });
    }

    const { codeVerifier, codeChallenge } = generatePKCE();
    const cookieStore = await cookies();
    cookieStore.set(
      getGarminVerifierCookieName(athleteId),
      codeVerifier,
      getGarminCookieOptions()
    );

    const redirectUri = getGarminRedirectUri();
    const authUrl = buildGarminAuthUrl(codeChallenge, athleteId, redirectUri);

    console.log('✅ Garmin OAuth authorization URL generated');
    console.log('🔵 Server URL:', getGarminOAuthServerUrl());
    console.log('🔵 Redirect URI:', redirectUri);

    return NextResponse.json({ success: true, authUrl });
  } catch (error: unknown) {
    console.error('❌ Garmin authorize error:', error);
    return NextResponse.json({ error: 'Failed to initiate Garmin OAuth' }, { status: 500 });
  }
}
