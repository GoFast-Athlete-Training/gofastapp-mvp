export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  buildGarminAuthUrl,
  generatePKCE,
  getGarminCookieOptions,
  getGarminMobileReturnCookieName,
  getGarminRedirectUri,
  getGarminVerifierCookieName,
  isAllowedMobileReturnUrl,
} from '@/lib/garmin-oauth';

/**
 * GET /api/auth/garmin/mobile/start?athleteId=xxx&returnUrl=gofast://settings/garmin
 *
 * Mobile OAuth entry: sets PKCE + mobile return cookies in the browser session,
 * then redirects to Garmin. The callback completes on prod and deep-links back to the app.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const athleteId = url.searchParams.get('athleteId');
    const returnUrl = url.searchParams.get('returnUrl');

    if (!athleteId) {
      return NextResponse.json({ error: 'athleteId is required' }, { status: 400 });
    }

    if (!returnUrl || !isAllowedMobileReturnUrl(returnUrl)) {
      return NextResponse.json(
        { error: 'returnUrl must be gofast://settings/garmin' },
        { status: 400 }
      );
    }

    const { codeVerifier, codeChallenge } = generatePKCE();
    const cookieStore = await cookies();
    const cookieOptions = getGarminCookieOptions();

    cookieStore.set(getGarminVerifierCookieName(athleteId), codeVerifier, cookieOptions);
    cookieStore.set(getGarminMobileReturnCookieName(athleteId), returnUrl, cookieOptions);

    const redirectUri = getGarminRedirectUri();
    const authUrl = buildGarminAuthUrl(codeChallenge, athleteId, redirectUri);

    return NextResponse.redirect(authUrl);
  } catch (error: unknown) {
    console.error('❌ Garmin mobile start error:', error);
    return NextResponse.json({ error: 'Failed to initiate mobile Garmin OAuth' }, { status: 500 });
  }
}
