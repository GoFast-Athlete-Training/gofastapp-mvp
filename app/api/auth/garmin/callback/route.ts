export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens } from '@/lib/garmin-pkce';
import { updateGarminConnection, fetchAndSaveGarminUserInfo } from '@/lib/domain-garmin';

/**
 * GET /api/auth/garmin/callback
 * 
 * Handles OAuth callback from Garmin.
 * Exchanges authorization code for access tokens and saves to database.
 */
export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Get cookies early
    const cookieStore = await cookies();

    // Helper function to return error HTML
    const returnErrorHtml = (errorMsg: string) => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Garmin Connection Failed</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #f3f4f6;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              }
              .error {
                color: #ef4444;
                font-size: 1.5rem;
                margin-bottom: 1rem;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error">✗</div>
              <h1>Connection Failed</h1>
              <p>${errorMsg}</p>
              <p style="font-size: 0.875rem; color: #6b7280; margin-top: 1rem;">This window will close automatically...</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage('garmin-oauth-error', window.location.origin);
                setTimeout(() => window.close(), 2000);
              } else {
                setTimeout(() => {
                  window.location.href = '/settings/garmin?error=${encodeURIComponent(errorMsg)}';
                }, 2000);
              }
            </script>
          </body>
        </html>
      `;
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    };

    // 1. Handle OAuth errors
    if (error) {
      console.error(`❌ OAuth error from Garmin: ${error}`);
      return returnErrorHtml(`OAuth error: ${error}`);
    }

    // 2. Validate required parameters
    if (!code || !state) {
      console.error('❌ Missing required parameters:', { code: !!code, state: !!state });
      return returnErrorHtml('Missing required parameters');
    }

    // 3. Get code verifier and athleteId from cookies
    const codeVerifierCookie = await cookieStore.get('garmin_code_verifier');
    const athleteIdCookie = await cookieStore.get('garmin_athlete_id');
    const codeVerifier = codeVerifierCookie?.value;
    const athleteId = athleteIdCookie?.value;

    if (!codeVerifier || !athleteId) {
      console.error('❌ Missing code verifier or athleteId in cookies');
      return returnErrorHtml('Session expired. Please try again.');
    }

    // 4. Exchange authorization code for tokens
    const redirectUri = process.env.GARMIN_REDIRECT_URI;
    
    if (!redirectUri) {
      console.error('❌ GARMIN_REDIRECT_URI is not configured');
      return returnErrorHtml('Garmin redirect URI not configured');
    }
    
    console.log(`🔍 Exchanging code for tokens for athleteId: ${athleteId}`);
    const tokenResult = await exchangeCodeForTokens(code, codeVerifier, redirectUri);

    if (!tokenResult.success) {
      console.error(`❌ Token exchange failed:`, tokenResult.error);
      return returnErrorHtml('Token exchange failed. Please try again.');
    }

    const { tokens } = tokenResult;
    console.log(`✅ Tokens received for athleteId: ${athleteId}`);

    // 5. Fetch Garmin user info to get user ID
    const userInfoResult = await fetchAndSaveGarminUserInfo(
      athleteId,
      tokens.access_token
    );

    if (!userInfoResult.success) {
      console.warn(`⚠️ Could not fetch Garmin user info: ${userInfoResult.error}`);
      // Continue anyway - we'll try to get user ID later
    }

    // 6. Save tokens to database
    await updateGarminConnection(athleteId, {
      garmin_user_id: userInfoResult.garminUserId || 'pending',
      garmin_access_token: tokens.access_token,
      garmin_refresh_token: tokens.refresh_token,
      garmin_expires_in: tokens.expires_in || 3600,
      garmin_scope: tokens.scope
    });

    console.log(`✅ Garmin tokens saved for athleteId: ${athleteId}`);

    // 7. Clean up cookies
    await cookieStore.delete('garmin_code_verifier');
    await cookieStore.delete('garmin_athlete_id');

    // 8. Return HTML page that works for both popup and normal redirect
    // The JavaScript will detect if it's in a popup and handle accordingly
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Garmin Connected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #f3f4f6;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .success {
              color: #10b981;
              font-size: 1.5rem;
              margin-bottom: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✓</div>
            <h1>Garmin Connected Successfully!</h1>
            <p>This window will close automatically...</p>
          </div>
          <script>
            // Send success message to parent window if in popup
            if (window.opener) {
              console.log('✅ Sending success message to parent window');
              window.opener.postMessage('garmin-oauth-success', window.location.origin);
              setTimeout(() => window.close(), 1000);
            } else {
              // Fallback: redirect if not in popup
              setTimeout(() => {
                window.location.href = '/settings?connected=garmin';
              }, 1500);
            }
          </script>
        </body>
      </html>
    `;
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (err: any) {
    console.error('❌ Garmin callback error:', err);
    
    // Return error HTML that works for both popup and normal flow
    const errorMessage = (err.message || 'Callback failed').replace(/'/g, "\\'");
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Garmin Connection Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #f3f4f6;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .error {
              color: #ef4444;
              font-size: 1.5rem;
              margin-bottom: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">✗</div>
            <h1>Connection Failed</h1>
            <p>${errorMessage}</p>
            <p style="font-size: 0.875rem; color: #6b7280; margin-top: 1rem;">This window will close automatically...</p>
          </div>
          <script>
            if (window.opener) {
                window.opener.postMessage('garmin-oauth-error', window.location.origin);
              setTimeout(() => window.close(), 2000);
            } else {
              setTimeout(() => {
                window.location.href = '/settings/garmin?error=callback_failed';
              }, 2000);
            }
          </script>
        </body>
      </html>
    `;
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

