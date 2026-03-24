export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeTestCodeForTokens } from "@/lib/garmin-pkce";
import {
  fetchGarminTestUserId,
  updateGarminTestConnection,
} from "@/lib/domain-garmin";
import { getAthleteById } from "@/lib/domain-athlete";

/**
 * GET /api/auth/garmin-test/callback?code=...&state=athleteId
 *
 * Saves **only** test fields: garmin_test_access_token, garmin_test_user_id, garmin_use_test_tokens.
 * Does not modify prod Garmin columns (garmin_user_id, garmin_access_token, etc.).
 */
export async function GET(request: Request) {
  const returnErrorHtml = (errorMsg: string) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Garmin Test Connection Failed</title></head>
        <body>
          <h1>Connection Failed</h1>
          <p>${errorMsg}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GARMIN_TEST_OAUTH_ERROR', error: '${errorMsg.replace(/'/g, "\\'")}' }, '*');
              setTimeout(() => window.close(), 1000);
            }
          </script>
        </body>
      </html>
    `;
    return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
  };

  try {
    const searchParams = new URL(request.url).searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      return returnErrorHtml(`OAuth error: ${oauthError}`);
    }

    const athleteId = state;
    if (!athleteId) {
      return returnErrorHtml("Missing athlete ID");
    }
    if (!code) {
      return returnErrorHtml("Missing authorization code");
    }

    const cookieStore = await cookies();
    const cookieName = `garmin_test_code_verifier_${athleteId}`;
    const codeVerifierCookie = await cookieStore.get(cookieName);
    const codeVerifier = codeVerifierCookie?.value;

    if (!codeVerifier) {
      return returnErrorHtml("Session expired. Please try again.");
    }

    let serverUrl =
      process.env.SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`;
    if (process.env.NODE_ENV === "production") {
      serverUrl = "https://pr.gofastcrushgoals.com";
    } else if (!serverUrl) {
      return returnErrorHtml("Server URL not configured");
    }

    const redirectUri = `${serverUrl}/api/auth/garmin-test/callback`;
    const tokenResult = await exchangeTestCodeForTokens(code, codeVerifier, redirectUri);

    if (!tokenResult.success) {
      return returnErrorHtml(`Token exchange failed: ${tokenResult.error}`);
    }

    const { tokens } = tokenResult;
    if (!tokens.access_token) {
      return returnErrorHtml("No access_token in Garmin response");
    }

    const userIdResult = await fetchGarminTestUserId(tokens.access_token);
    const testUserId = userIdResult.success && userIdResult.garminUserId
      ? userIdResult.garminUserId
      : "pending";

    if (!userIdResult.success) {
      console.warn("[garmin-test/callback] Could not fetch test user id:", userIdResult.error);
    }

    // Test Garmin login email lives on Athlete.garmin_test_linked_email first; cookie/env are fallbacks
    const athleteRow = await getAthleteById(athleteId);
    const fromDb = athleteRow?.garmin_test_linked_email?.trim() || null;
    const hintCookie = await cookieStore.get(`garmin_test_linked_email_hint_${athleteId}`);
    const fromCookie = hintCookie?.value?.trim() || null;
    const fromEnv = process.env.GARMIN_TEST_LINKED_ACCOUNT_EMAIL?.trim() || null;
    const linkedEmail = fromDb || fromCookie || fromEnv || undefined;

    await updateGarminTestConnection(athleteId, {
      garmin_test_access_token: tokens.access_token,
      garmin_test_user_id: testUserId,
      garmin_use_test_tokens: true,
      ...(linkedEmail ? { garmin_test_linked_email: linkedEmail } : {}),
    });

    await cookieStore.delete(cookieName);
    await cookieStore.delete(`garmin_test_linked_email_hint_${athleteId}`);

    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Garmin Test Connected</title></head>
        <body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f3f4f6;">
          <div style="text-align:center;padding:2rem;background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <div style="color:#10b981;font-size:1.5rem;margin-bottom:1rem;">✓</div>
            <h1>Garmin test account linked</h1>
            <p>This window will close automatically…</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GARMIN_TEST_OAUTH_SUCCESS' }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              setTimeout(() => { window.location.href = '/settings/garmin?garminTest=connected'; }, 1500);
            }
          </script>
        </body>
      </html>
    `;
    return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
  } catch (err: unknown) {
    console.error("Garmin test callback error:", err);
    const message = err instanceof Error ? err.message : "Callback failed";
    return returnErrorHtml(message);
  }
}
