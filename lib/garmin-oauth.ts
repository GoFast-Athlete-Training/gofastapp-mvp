/**
 * Garmin OAuth Helper Module
 *
 * Centralized OAuth utilities for Garmin integration
 */

import { generatePKCE, buildGarminAuthUrl, exchangeCodeForTokens, fetchGarminUserInfo } from './garmin-pkce';
import {
  updateGarminConnection,
  fetchAndSaveGarminUserInfo,
  registerGarminUser,
} from './domain-garmin';

export interface GarminOAuthResult {
  success: boolean;
  athleteId?: string;
  garminUserId?: string;
  error?: string;
}

export type GarminCookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  maxAge: number;
  path: string;
  domain?: string;
};

const PROD_GARMIN_OAUTH_ORIGIN = 'https://pr.gofastcrushgoals.com';

/**
 * OAuth server origin used for redirect_uri and mobile start redirects.
 * Production always uses pr.gofastcrushgoals.com so Garmin callback stays registered.
 */
export function getGarminOAuthServerUrl(): string {
  let serverUrl =
    process.env.SERVER_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (process.env.NODE_ENV === 'production') {
    serverUrl = PROD_GARMIN_OAUTH_ORIGIN;
  }

  if (!serverUrl) {
    throw new Error('SERVER_URL or NEXT_PUBLIC_APP_URL must be set');
  }

  return serverUrl.replace(/\/$/, '');
}

/**
 * Complete OAuth flow: exchange code for tokens and save to database
 */
export async function completeGarminOAuth(
  athleteId: string,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<GarminOAuthResult> {
  try {
    // 1. Exchange code for tokens
    const tokenResult = await exchangeCodeForTokens(code, codeVerifier, redirectUri);

    if (!tokenResult.success) {
      return {
        success: false,
        error: tokenResult.error || 'Token exchange failed',
      };
    }

    const { tokens } = tokenResult;

    // 2. Fetch Garmin user info to get user ID
    const userInfoResult = await fetchAndSaveGarminUserInfo(athleteId, tokens.access_token);

    const garminUserId = userInfoResult.garminUserId;

    // 3. Save tokens to database
    await updateGarminConnection(athleteId, {
      ...(garminUserId ? { garmin_user_id: garminUserId } : {}),
      garmin_access_token: tokens.access_token,
      garmin_refresh_token: tokens.refresh_token,
      garmin_expires_in: tokens.expires_in || 3600,
      garmin_scope: tokens.scope,
      garmin_permissions: {
        read: (tokens.scope || '').includes('READ'),
        write: (tokens.scope || '').includes('WRITE'),
        scope: tokens.scope,
        grantedAt: new Date().toISOString(),
      },
    });

    const regResult = await registerGarminUser(tokens.access_token);
    if (!regResult.ok) {
      console.warn(
        `⚠️ [completeGarminOAuth] Garmin registration failed status=${regResult.status} — webhooks may not fire`
      );
    } else {
      console.log(
        `✅ [completeGarminOAuth] Garmin wellness registration complete status=${regResult.status}`
      );
    }

    return {
      success: true,
      athleteId,
      garminUserId: garminUserId || undefined,
    };
  } catch (error: any) {
    console.error('❌ Complete OAuth flow error:', error);
    return {
      success: false,
      error: error.message || 'OAuth flow failed',
    };
  }
}

/**
 * @deprecated Prefer getGarminOAuthServerUrl for OAuth flows.
 */
export function getServerUrl(): string {
  return getGarminOAuthServerUrl();
}

/** Garmin OAuth callback URL registered with Garmin Connect. */
export function getGarminRedirectUri(): string {
  return `${getGarminOAuthServerUrl()}/api/auth/garmin/callback`;
}

/** HTTP-only cookie storing PKCE verifier keyed by athlete id. */
export function getGarminVerifierCookieName(athleteId: string): string {
  return `garmin_code_verifier_${athleteId}`;
}

/** HTTP-only cookie storing mobile deep-link return URL keyed by athlete id. */
export function getGarminMobileReturnCookieName(athleteId: string): string {
  return `garmin_mobile_return_${athleteId}`;
}

export function getGarminCookieOptions(): GarminCookieOptions {
  const options: GarminCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  };

  if (process.env.NODE_ENV === 'production') {
    options.domain = '.gofastcrushgoals.com';
  }

  return options;
}

/** Allowlisted deep links for mobile OAuth return (gofast://settings/garmin). */
export function isAllowedMobileReturnUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'gofast:' &&
      parsed.hostname === 'settings' &&
      parsed.pathname === '/garmin'
    );
  } catch {
    return false;
  }
}

export function appendGarminMobileReturnParams(
  returnUrl: string,
  params: Record<string, string>
): string {
  const [base] = returnUrl.split('?');
  const qs = new URLSearchParams(params).toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Get Garmin webhook URI
 */
export function getGarminWebhookUri(): string {
  return `${getGarminOAuthServerUrl()}/api/garmin/webhook`;
}

export { generatePKCE, buildGarminAuthUrl, exchangeCodeForTokens, fetchGarminUserInfo };

