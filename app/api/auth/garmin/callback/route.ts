export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens } from '@/lib/garmin-pkce';
import { updateGarminConnection, fetchAndSaveGarminUserInfo } from '@/lib/domain-garmin';

/**
 * GET /api/auth/garmin/callback?code=XXX&state=athleteId
 * 
 * Handles OAuth callback from Garmin (server-only).
 * Exchanges authorization code for access tokens and saves to database.
 */
export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');  // state = athleteId
    const error = searchParams.get('error');

    // Helper function to return error HTML
    const returnErrorHtml = (errorMsg: string) => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Garmin Connection Failed</title>
          </head>
          <body>
            <h1>Connection Failed</h1>
            <p>${errorMsg}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GARMIN_OAUTH_ERROR', error: '${errorMsg.replace(/'/g, "\\'")}' }, '*');
                setTimeout(() => {
                  window.close();
                }, 1000);
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

    // 2. Extract athleteId from state parameter
    const athleteId = state;  // state IS the athleteId (legacy pattern)
    
    if (!athleteId) {
      console.error('❌ Missing state parameter (athleteId)');
      return returnErrorHtml('Missing athlete ID');
    }

    // 3. Extract code
    if (!code) {
      console.error('❌ Missing code parameter');
      return returnErrorHtml('Missing authorization code');
    }

    console.log(`🔍 Processing callback for athleteId: ${athleteId}`);

    // 4. Retrieve codeVerifier from cookie storage
    const cookieStore = await cookies();
    const codeVerifierCookie = await cookieStore.get(`garmin_code_verifier_${athleteId}`);
    const codeVerifier = codeVerifierCookie?.value;

    if (!codeVerifier) {
      console.error(`❌ No code verifier found for athleteId: ${athleteId}`);
      return returnErrorHtml('Session expired. Please try again.');
    }

    // 5. Build redirect URI (must match authorize route - production must use SERVER_URL)
    const serverUrl = process.env.SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`;
    if (!serverUrl) {
      console.error('❌ SERVER_URL or NEXT_PUBLIC_APP_URL must be set');
      return returnErrorHtml('Server URL not configured');
    }
    const redirectUri = `${serverUrl}/api/auth/garmin/callback`;

    // 6. Exchange code for tokens
    console.log(`🔍 Exchanging code for tokens for athleteId: ${athleteId}`);
    const tokenResult = await exchangeCodeForTokens(code, codeVerifier, redirectUri);

    if (!tokenResult.success) {
      console.error(`❌ Token exchange failed:`, tokenResult.error);
      return returnErrorHtml('Token exchange failed. Please try again.');
    }

    const { tokens } = tokenResult;
    console.log(`✅ Tokens received for athleteId: ${athleteId}`);

    // 7. Fetch Garmin user ID and save to database
    console.log(`🔍 Fetching Garmin user ID for athleteId: ${athleteId}`);
    const userInfoResult = await fetchAndSaveGarminUserInfo(athleteId, tokens.access_token);

    let garminUserId = userInfoResult.garminUserId || 'pending';
    if (userInfoResult.success) {
      console.log(`✅ Garmin user ID fetched and saved: ${garminUserId}`);
    } else {
      console.warn(`⚠️ Could not fetch Garmin user info: ${userInfoResult.error}`);
    }

    // 8. Save tokens to database
    await updateGarminConnection(athleteId, {
      garmin_user_id: garminUserId,
      garmin_access_token: tokens.access_token,
      garmin_refresh_token: tokens.refresh_token,
      garmin_expires_in: tokens.expires_in || 3600,
      garmin_scope: tokens.scope
    });

    console.log(`✅ Garmin tokens saved for athleteId: ${athleteId}`);

    // 9. Clean up cookie
    await cookieStore.delete(`garmin_code_verifier_${athleteId}`);

    // 10. Return HTML page that closes popup and notifies parent
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
            if (window.opener) {
              window.opener.postMessage({ type: 'GARMIN_OAUTH_SUCCESS' }, '*');
              setTimeout(() => {
                window.close();
              }, 1000);
            } else {
              setTimeout(() => {
                window.location.href = '/athlete-home';
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
    
    const errorMessage = (err.message || 'Callback failed').replace(/'/g, "\\'");
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Garmin Connection Failed</title>
        </head>
        <body>
          <h1>Connection Failed</h1>
          <p>${errorMessage}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GARMIN_OAUTH_ERROR', error: '${errorMessage}' }, '*');
              setTimeout(() => {
                window.close();
              }, 1000);
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

