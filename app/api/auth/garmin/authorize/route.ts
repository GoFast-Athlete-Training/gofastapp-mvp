export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { generatePKCE, buildGarminAuthUrl } from '@/lib/garmin-pkce';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/garmin/authorize?athleteId=xxx
 * 
 * Starts OAuth handshake with Garmin using PKCE flow.
 * Returns JSON with authorization URL (client opens popup).
 */
export async function GET(request: Request) {
  try {
    console.log('🔵 Garmin authorize endpoint called');
    
    // 1. Read athleteId from query param
    const url = new URL(request.url);
    const athleteId = url.searchParams.get('athleteId');
    
    if (!athleteId) {
      console.error('❌ athleteId query parameter is required');
      return NextResponse.json(
        { error: 'athleteId is required' },
        { status: 400 }
      );
    }

    console.log('✅ Athlete ID from query:', athleteId);

    // 2. Generate PKCE parameters (no state - we use athleteId)
    const { codeVerifier, codeChallenge } = generatePKCE();
    console.log('✅ PKCE generated - code_verifier length:', codeVerifier.length, 'code_challenge length:', codeChallenge.length);
    
    // 3. Store code verifier in HTTP-only cookie (keyed by athleteId in cookie name)
    const cookieStore = await cookies();
    cookieStore.set(`garmin_code_verifier_${athleteId}`, codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/'
    });

    console.log('✅ Code verifier stored in cookie');

    // 4. Build server callback URL
    const serverUrl = process.env.SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://gofast.gofastcrushgoals.com';
    const redirectUri = `${serverUrl}/api/auth/garmin/callback`;
    
    console.log('🔵 Redirect URI:', redirectUri);

    // 5. Build Garmin authorization URL with athleteId as state
    const authUrl = buildGarminAuthUrl(codeChallenge, athleteId, redirectUri);

    console.log('✅ Garmin OAuth authorization URL generated');
    console.log('🔵 Auth URL:', authUrl);
    console.log('🔵 State (athleteId):', athleteId);

    // 6. Return JSON with authUrl (client opens popup)
    return NextResponse.json({ authUrl });

  } catch (error: any) {
    console.error('❌ Garmin authorize error:', error);
    console.error('❌ Stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to initiate Garmin OAuth' },
      { status: 500 }
    );
  }
}
