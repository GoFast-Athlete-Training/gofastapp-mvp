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
 * Generate PKCE parameters and build auth URL
 */
export function initiateGarminOAuth(redirectUri: string) {
  const { codeVerifier, codeChallenge, state } = generatePKCE();
  const authUrl = buildGarminAuthUrl(codeChallenge, state, redirectUri);
  
  return {
    codeVerifier,
    state,
    authUrl
  };
}

export { generatePKCE, buildGarminAuthUrl, exchangeCodeForTokens, fetchGarminUserInfo };

