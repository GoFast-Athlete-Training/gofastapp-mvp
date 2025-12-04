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
 * ALWAYS returns a 302 redirect to Garmin's OAuth page.
 */
export async function GET(request: Request) {
  try {
    console.log('🔵 Garmin authorize endpoint called');
    
    // 1. Authenticate user via Firebase
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('❌ No authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
      console.log('✅ Firebase token verified for UID:', decodedToken.uid);
    } catch (error: any) {
      console.error('❌ Invalid Firebase token:', error.message);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Get athlete from database
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      console.error('❌ Athlete not found for UID:', decodedToken.uid);
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    console.log('✅ Athlete found:', athlete.id);

    // 3. Generate PKCE parameters
    const { codeVerifier, codeChallenge, state } = generatePKCE();
    console.log('✅ PKCE generated - code_verifier length:', codeVerifier.length, 'code_challenge length:', codeChallenge.length, 'state:', state);
    
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
    
    // Store state in cookie for verification
    cookieStore.set('garmin_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/'
    });

    console.log('✅ Cookies set: garmin_code_verifier, garmin_athlete_id, garmin_oauth_state');

    // 5. Build Garmin authorization URL
    // Use ONLY environment variable - NO fallbacks
    const redirectUri = process.env.GARMIN_REDIRECT_URI;
    
    if (!redirectUri) {
      console.error('❌ GARMIN_REDIRECT_URI is not configured');
      return NextResponse.json(
        { error: 'Garmin redirect URI not configured' },
        { status: 500 }
      );
    }
    
    const authUrl = buildGarminAuthUrl(codeChallenge, state, redirectUri);

    console.log('✅ Garmin OAuth authorization URL generated');
    console.log('🔵 Auth URL:', authUrl);
    console.log('🔵 Redirect URI:', redirectUri);
    console.log('🔵 Client ID:', process.env.GARMIN_CLIENT_ID ? 'Set' : 'Missing');
    console.log('🔵 Code Challenge:', codeChallenge.substring(0, 20) + '...');
    console.log('🔵 State:', state);

    // 6. Check if this is a popup request
    const url = new URL(request.url);
    const isPopup = url.searchParams.get('popup') === 'true';

    if (isPopup) {
      // Return JSON with URL for popup flow
      console.log('✅ Returning JSON with auth URL for popup');
      return NextResponse.json({ url: authUrl });
    }

    // 7. Otherwise, return redirect for normal flow
    console.log('✅ Returning 302 redirect to Garmin OAuth page');
    return NextResponse.redirect(authUrl);

  } catch (error: any) {
    console.error('❌ Garmin authorize error:', error);
    console.error('❌ Stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to initiate Garmin OAuth' },
      { status: 500 }
    );
  }
}
