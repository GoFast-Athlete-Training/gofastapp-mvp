/**
 * Garmin OAuth Helper Module
 * 
 * Centralized OAuth utilities for Garmin integration
 */

import { generatePKCE, buildGarminAuthUrl, exchangeCodeForTokens, fetchGarminUserInfo } from './garmin-pkce';
import { updateGarminConnection, fetchAndSaveGarminUserInfo } from './domain-garmin';

export interface GarminOAuthResult {
  success: boolean;
  athleteId?: string;
  garminUserId?: string;
  error?: string;
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
        error: tokenResult.error || 'Token exchange failed'
      };
    }

    const { tokens } = tokenResult;

    // 2. Fetch Garmin user info to get user ID
    const userInfoResult = await fetchAndSaveGarminUserInfo(
      athleteId,
      tokens.access_token
    );

    const garminUserId = userInfoResult.garminUserId || 'pending';

    // 3. Save tokens to database
    await updateGarminConnection(athleteId, {
      garmin_user_id: garminUserId,
      garmin_access_token: tokens.access_token,
      garmin_refresh_token: tokens.refresh_token,
      garmin_expires_in: tokens.expires_in || 3600,
      garmin_scope: tokens.scope
    });

    return {
      success: true,
      athleteId,
      garminUserId: garminUserId !== 'pending' ? garminUserId : undefined
    };

  } catch (error: any) {
    console.error('❌ Complete OAuth flow error:', error);
    return {
      success: false,
      error: error.message || 'OAuth flow failed'
    };
  }
}

/**
 * Get server URL for building redirect URIs
 * Production must use SERVER_URL environment variable
 */
export function getServerUrl(): string {
  const serverUrl = process.env.SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`;
  if (!serverUrl) {
    throw new Error('SERVER_URL or NEXT_PUBLIC_APP_URL must be set');
  }
  return serverUrl;
}

/**
 * Get Garmin redirect URI (callback URL)
 */
export function getGarminRedirectUri(): string {
  const serverUrl = getServerUrl();
  return `${serverUrl}/api/auth/garmin/callback`;
}

/**
 * Get Garmin webhook URI
 */
export function getGarminWebhookUri(): string {
  const serverUrl = getServerUrl();
  return `${serverUrl}/api/garmin/webhook`;
}

export { generatePKCE, buildGarminAuthUrl, exchangeCodeForTokens, fetchGarminUserInfo };

