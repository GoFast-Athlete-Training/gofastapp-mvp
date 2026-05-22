export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  appendGarminMobileReturnParams,
  completeGarminOAuth,
  getGarminMobileReturnCookieName,
  getGarminRedirectUri,
  getGarminVerifierCookieName,
  isAllowedMobileReturnUrl,
} from '@/lib/garmin-oauth';

/**
 * GET /api/auth/garmin/callback?code=XXX&state=athleteId
 *
 * Handles OAuth callback from Garmin (server-only).
 * Web popup: postMessage + close. Mobile: redirect to gofast:// deep link when configured.
 */
export async function GET(request: Request) {
  const cookieStore = await cookies();

  const getMobileReturnUrl = async (athleteId: string | null | undefined) => {
    if (!athleteId) return null;
    const cookieName = getGarminMobileReturnCookieName(athleteId);
    const value = (await cookieStore.get(cookieName))?.value;
    if (!value || !isAllowedMobileReturnUrl(value)) return null;
    return value;
  };

  const redirectMobile = async (
    athleteId: string | null | undefined,
    params: Record<string, string>
  ) => {
    const mobileReturn = await getMobileReturnUrl(athleteId);
    if (!mobileReturn) return null;

    await cookieStore.delete(getGarminMobileReturnCookieName(athleteId!));
    if (athleteId) {
      await cookieStore.delete(getGarminVerifierCookieName(athleteId));
    }

    return NextResponse.redirect(appendGarminMobileReturnParams(mobileReturn, params));
  };

  const returnErrorHtml = (errorMsg: string, athleteId?: string | null) => {
    const safeMsg = errorMsg.replace(/'/g, "\\'");
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
              window.opener.postMessage({ type: 'GARMIN_OAUTH_ERROR', error: '${safeMsg}' }, '*');
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

  try {
    const searchParams = new URL(request.url).searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const athleteId = state;

    if (error) {
      console.error(`❌ OAuth error from Garmin: ${error}`);
      const mobileRedirect = await redirectMobile(athleteId, {
        garmin: 'error',
        msg: error,
      });
      if (mobileRedirect) return mobileRedirect;
      return returnErrorHtml(`OAuth error: ${error}`, athleteId);
    }

    if (!athleteId) {
      console.error('❌ Missing state parameter (athleteId)');
      return returnErrorHtml('Missing athlete ID');
    }

    if (!code) {
      console.error('❌ Missing code parameter');
      const mobileRedirect = await redirectMobile(athleteId, {
        garmin: 'error',
        msg: 'Missing authorization code',
      });
      if (mobileRedirect) return mobileRedirect;
      return returnErrorHtml('Missing authorization code', athleteId);
    }

    const codeVerifier = (await cookieStore.get(getGarminVerifierCookieName(athleteId)))?.value;
    if (!codeVerifier) {
      console.error(`❌ No code verifier found for athleteId: ${athleteId}`);
      const mobileRedirect = await redirectMobile(athleteId, {
        garmin: 'error',
        msg: 'Session expired. Please try again.',
      });
      if (mobileRedirect) return mobileRedirect;
      return returnErrorHtml('Session expired. Please try again.', athleteId);
    }

    const redirectUri = getGarminRedirectUri();
    const mobileReturnUrl = await getMobileReturnUrl(athleteId);
    const oauthResult = await completeGarminOAuth(athleteId, code, codeVerifier, redirectUri);

    await cookieStore.delete(getGarminVerifierCookieName(athleteId));
    await cookieStore.delete(getGarminMobileReturnCookieName(athleteId));

    if (!oauthResult.success) {
      if (mobileReturnUrl) {
        return NextResponse.redirect(
          appendGarminMobileReturnParams(mobileReturnUrl, {
            garmin: 'error',
            msg: oauthResult.error || 'OAuth flow failed',
          })
        );
      }
      return returnErrorHtml(oauthResult.error || 'OAuth flow failed', athleteId);
    }

    if (mobileReturnUrl) {
      return NextResponse.redirect(
        appendGarminMobileReturnParams(mobileReturnUrl, { garmin: 'connected' })
      );
    }

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
                window.location.href = '/settings?garmin=connected';
              }, 1500);
            }
          </script>
        </body>
      </html>
    `;
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err: unknown) {
    console.error('❌ Garmin callback error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Callback failed';
    const athleteId = new URL(request.url).searchParams.get('state');
    const mobileRedirect = await redirectMobile(athleteId, {
      garmin: 'error',
      msg: errorMessage,
    });
    if (mobileRedirect) return mobileRedirect;

    const safeMsg = errorMessage.replace(/'/g, "\\'");
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
              window.opener.postMessage({ type: 'GARMIN_OAUTH_ERROR', error: '${safeMsg}' }, '*');
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
