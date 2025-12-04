export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { generatePKCE, buildGarminAuthUrl } from '@/lib/garmin-pkce';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/garmin/authorize
 * 
 * Starts OAuth handshake with Garmin using PKCE flow.
 * Requires Firebase authentication.
 */
export async function GET(request: Request) {
  try {
    // 1. Authenticate user via Firebase
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Get athlete from database
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // 3. Generate PKCE parameters
    const { codeVerifier, codeChallenge, state } = generatePKCE();
    
    // 4. Store code verifier in HTTP-only cookie (expires in 10 minutes)
    const cookieStore = await cookies();
    cookieStore.set('garmin_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/'
    });
    
    // Also store athleteId in cookie for callback verification
    cookieStore.set('garmin_athlete_id', athlete.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/'
    });

    // 5. Build Garmin authorization URL
    // Note: redirect URI must match Garmin Developer Portal exactly (no popup param)
    const redirectUri = process.env.GARMIN_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/garmin/callback`;
    
    const authUrl = buildGarminAuthUrl(codeChallenge, state, redirectUri);

    console.log(`✅ Garmin OAuth authorization URL generated for athlete: ${athlete.id}`);

    // 6. Check if this is a popup request (via query param or header)
    const url = new URL(request.url);
    const isPopup = url.searchParams.get('popup') === 'true' || 
                    request.headers.get('x-popup-request') === 'true';

    if (isPopup) {
      // Return JSON with auth URL for popup flow
      return NextResponse.json({
        success: true,
        authUrl: authUrl
      });
    }

    // 6. Redirect user to Garmin (normal flow)
    return NextResponse.redirect(authUrl);

  } catch (error: any) {
    console.error('❌ Garmin authorize error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Garmin OAuth' },
      { status: 500 }
    );
  }
}

